//! CSV column types: how each maps to mongoimport's typed field list, and the type RipeMongo
//! suggests from a column's values.

use serde::{Deserialize, Serialize};
use specta::Type;

use crate::tools::ToolsError;

/// Go layout of ISO 8601 date-times with a time zone (`2024-03-05T10:20:30.5+02:00`).
const ISO_LAYOUT: &str = "2006-01-02T15:04:05Z07:00";
/// Go layout of ISO 8601 date-times without a zone (read as UTC).
const ISO_LOCAL_LAYOUT: &str = "2006-01-02T15:04:05";
/// Value shapes (digits as `9`) of common dates, with their `date_ms` layout.
const DATE_SHAPES: [(&str, &str); 3] = [
    ("9999-99-99", "yyyy-MM-dd"),
    ("9999-99-99 99:99:99", "yyyy-MM-dd HH:mm:ss"),
    ("99.99.9999", "dd.MM.yyyy"),
];
/// Shape of the date and time part of an ISO 8601 date-time.
const ISO_SHAPE: &str = "9999-99-99T99:99:99";

/// The type a CSV column is imported as.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum ColumnType {
    /// Numbers become numbers, everything else text (mongoimport's default).
    Auto,
    /// Always text, keeping leading zeros (`01234`).
    String,
    Int32,
    Int64,
    Double,
    /// Exact decimal (Decimal128).
    Decimal,
    /// `true`/`false` (also `1`/`0`, `t`/`f`).
    Boolean,
    /// ISO 8601 date-time with a time zone.
    IsoDate,
    /// ISO 8601 date-time without a time zone, read as UTC.
    IsoLocalDate,
    /// A date in a custom layout (`dd.MM.yyyy HH:mm`).
    Date,
    /// Binary data written in base64.
    Base64,
    /// Binary data written in hexadecimal.
    Hex,
}

impl ColumnType {
    /// The type part of mongoimport's `--fields` entry, e.g. `date_ms(dd.MM.yyyy)`.
    pub fn spec(self, date_format: &str) -> Result<String, ToolsError> {
        Ok(match self {
            ColumnType::Auto => "auto()".into(),
            ColumnType::String => "string()".into(),
            ColumnType::Int32 => "int32()".into(),
            ColumnType::Int64 => "int64()".into(),
            ColumnType::Double => "double()".into(),
            ColumnType::Decimal => "decimal()".into(),
            ColumnType::Boolean => "boolean()".into(),
            ColumnType::IsoDate => format!("date_go({ISO_LAYOUT})"),
            ColumnType::IsoLocalDate => format!("date_go({ISO_LOCAL_LAYOUT})"),
            ColumnType::Date => {
                if date_format.is_empty() || date_format.contains([',', '(', ')']) {
                    return Err(ToolsError::Invalid(
                        "Enter the date format, for example dd.MM.yyyy (without , ( or )).".into(),
                    ));
                }
                format!("date_ms({date_format})")
            }
            ColumnType::Base64 => "binary(base64)".into(),
            ColumnType::Hex => "binary(hex)".into(),
        })
    }
}

/// A suggested column type, with the date layout for [`ColumnType::Date`].
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct TypeSuggestion {
    #[serde(rename = "type")]
    pub kind: ColumnType,
    pub date_format: String,
}

#[derive(PartialEq)]
enum Shape {
    Number { leading_zero: bool },
    Boolean,
    Date(&'static str),
    IsoDate,
    IsoLocalDate,
    Other,
}

/// The type that keeps a column's sample values intact: text for numbers with leading zeros,
/// booleans, and dates in common layouts. Everything else stays automatic.
pub fn suggest_type<'a>(values: impl IntoIterator<Item = &'a str>) -> TypeSuggestion {
    let shapes: Vec<Shape> = values
        .into_iter()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(shape)
        .collect();
    let all = |wanted: &dyn Fn(&Shape) -> bool| !shapes.is_empty() && shapes.iter().all(wanted);
    let suggestion = |kind| TypeSuggestion {
        kind,
        date_format: String::new(),
    };
    if all(&|shape| matches!(shape, Shape::Number { .. })) {
        let zeros = shapes.contains(&Shape::Number { leading_zero: true });
        return suggestion(if zeros {
            ColumnType::String
        } else {
            ColumnType::Auto
        });
    }
    if all(&|shape| *shape == Shape::Boolean) {
        return suggestion(ColumnType::Boolean);
    }
    if all(&|shape| *shape == Shape::IsoDate) {
        return suggestion(ColumnType::IsoDate);
    }
    if all(&|shape| *shape == Shape::IsoLocalDate) {
        return suggestion(ColumnType::IsoLocalDate);
    }
    if let Some(Shape::Date(layout)) = shapes.first() {
        if all(&|shape| *shape == Shape::Date(layout)) {
            return TypeSuggestion {
                kind: ColumnType::Date,
                date_format: (*layout).to_owned(),
            };
        }
    }
    suggestion(ColumnType::Auto)
}

fn shape(value: &str) -> Shape {
    let digits = value.strip_prefix('-').unwrap_or(value);
    if !digits.is_empty() && digits.bytes().all(|byte| byte.is_ascii_digit()) {
        return Shape::Number {
            leading_zero: digits.len() > 1 && digits.starts_with('0'),
        };
    }
    if value.eq_ignore_ascii_case("true") || value.eq_ignore_ascii_case("false") {
        return Shape::Boolean;
    }
    let masked: String = value
        .chars()
        .map(|c| if c.is_ascii_digit() { '9' } else { c })
        .collect();
    if let Some((_, layout)) = DATE_SHAPES.iter().find(|(shape, _)| masked == *shape) {
        return Shape::Date(layout);
    }
    let Some(rest) = masked.strip_prefix(ISO_SHAPE) else {
        return Shape::Other;
    };
    let rest = match rest.strip_prefix('.') {
        Some(fraction) => fraction.trim_start_matches('9'),
        None => rest,
    };
    match rest {
        "" => Shape::IsoLocalDate,
        "Z" | "+99:99" | "-99:99" => Shape::IsoDate,
        _ => Shape::Other,
    }
}
