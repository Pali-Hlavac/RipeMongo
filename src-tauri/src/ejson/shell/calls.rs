//! mongosh helper functions and special words, translated into Extended JSON values.

use base64::engine::general_purpose::STANDARD as BASE64;
use base64::Engine;
use mongodb::bson::oid::ObjectId;
use mongodb::bson::DateTime;
use serde_json::{json, Value};

use super::Parser;
use crate::ejson::dates::parse_date;
use crate::ejson::EjsonError;

/// BSON binary subtype of UUIDs.
const UUID_SUBTYPE: &str = "04";
const UUID_HEX_LENGTH: usize = 32;
const OBJECT_ID_HEX_LENGTH: usize = 24;

/// Words that are values on their own (no parentheses).
pub(super) fn bare_word(parser: &Parser, word: &str) -> Result<Value, EjsonError> {
    Ok(match word {
        "true" => Value::Bool(true),
        "false" => Value::Bool(false),
        "null" => Value::Null,
        "undefined" => json!({ "$undefined": true }),
        "NaN" | "Infinity" => number_double(word),
        "MinKey" => json!({ "$minKey": 1 }),
        "MaxKey" => json!({ "$maxKey": 1 }),
        _ => return Err(parser.error(&format!("Unknown word '{word}' (strings need quotes)"))),
    })
}

/// `Name(args…)` with or without `new`.
pub(super) fn call(parser: &Parser, name: &str, args: Vec<Value>) -> Result<Value, EjsonError> {
    let fail = |message: &str| parser.error(&format!("{name}(): {message}"));
    match name {
        "ObjectId" => match args.as_slice() {
            [] => Ok(json!({ "$oid": ObjectId::new().to_hex() })),
            [Value::String(hex)] if is_hex(hex, OBJECT_ID_HEX_LENGTH) => Ok(json!({ "$oid": hex })),
            _ => Err(fail("expects a 24-character hex string")),
        },
        "ISODate" | "Date" => {
            date(&args).ok_or_else(|| fail("expects an ISO date string or milliseconds"))
        }
        "NumberLong" => integer_text(&args, i64::MIN, i64::MAX)
            .map(|text| json!({ "$numberLong": text }))
            .ok_or_else(|| fail("expects a 64-bit integer")),
        "NumberInt" => integer_text(&args, i64::from(i32::MIN), i64::from(i32::MAX))
            .map(|text| json!({ "$numberInt": text }))
            .ok_or_else(|| fail("expects a 32-bit integer")),
        "NumberDecimal" | "Decimal128" => match args.as_slice() {
            [Value::String(text)] => Ok(json!({ "$numberDecimal": text })),
            [Value::Number(number)] => Ok(json!({ "$numberDecimal": number.to_string() })),
            _ => Err(fail("expects a number or a numeric string")),
        },
        "UUID" => match args.as_slice() {
            [Value::String(text)] => uuid(text).ok_or_else(|| fail("expects a UUID string")),
            _ => Err(fail("expects a UUID string")),
        },
        "BinData" => match args.as_slice() {
            [Value::Number(subtype), Value::String(base64)] => subtype
                .as_u64()
                .filter(|s| *s <= u64::from(u8::MAX))
                .map(|s| binary(base64, &format!("{s:02x}")))
                .ok_or_else(|| fail("expects a subtype between 0 and 255")),
            _ => Err(fail("expects (subtype, base64 string)")),
        },
        "Timestamp" => timestamp(&args).ok_or_else(|| fail("expects (seconds, increment)")),
        "RegExp" => match args.as_slice() {
            [Value::String(pattern)] => Ok(regular_expression(pattern, "")),
            [Value::String(pattern), Value::String(flags)] => {
                Ok(regular_expression(pattern, flags))
            }
            _ => Err(fail("expects (pattern, flags)")),
        },
        "MinKey" if args.is_empty() => Ok(json!({ "$minKey": 1 })),
        "MaxKey" if args.is_empty() => Ok(json!({ "$maxKey": 1 })),
        _ => Err(parser.error(&format!("Unknown function {name}()"))),
    }
}

pub(super) fn number_double(text: &str) -> Value {
    json!({ "$numberDouble": text })
}

/// Extended JSON regular expression; options are sorted as the spec requires.
pub(super) fn regular_expression(pattern: &str, flags: &str) -> Value {
    let mut options: Vec<char> = flags.chars().collect();
    options.sort_unstable();
    options.dedup();
    json!({ "$regularExpression": { "pattern": pattern, "options": options.into_iter().collect::<String>() } })
}

fn date(args: &[Value]) -> Option<Value> {
    let date = match args {
        [] => DateTime::now(),
        [Value::String(text)] => parse_date(text)?,
        [Value::Number(millis)] => DateTime::from_millis(millis.as_i64()?),
        _ => return None,
    };
    Some(json!({ "$date": { "$numberLong": date.timestamp_millis().to_string() } }))
}

/// Accepts a number or a numeric string within `[min, max]`.
fn integer_text(args: &[Value], min: i64, max: i64) -> Option<String> {
    let value = match args {
        [Value::Number(number)] => number.as_i64()?,
        [Value::String(text)] => text.trim().parse::<i64>().ok()?,
        _ => return None,
    };
    (min..=max).contains(&value).then(|| value.to_string())
}

fn uuid(text: &str) -> Option<Value> {
    let hex: String = text.chars().filter(|c| *c != '-').collect();
    if !is_hex(&hex, UUID_HEX_LENGTH) {
        return None;
    }
    let bytes = (0..hex.len())
        .step_by(2)
        .map(|i| u8::from_str_radix(&hex[i..i + 2], 16))
        .collect::<Result<Vec<_>, _>>()
        .ok()?;
    Some(binary(&BASE64.encode(bytes), UUID_SUBTYPE))
}

fn binary(base64: &str, subtype: &str) -> Value {
    json!({ "$binary": { "base64": base64, "subType": subtype } })
}

fn timestamp(args: &[Value]) -> Option<Value> {
    let (t, i) = match args {
        [Value::Number(t), Value::Number(i)] => (t.as_u64()?, i.as_u64()?),
        [Value::Object(fields)] => (fields.get("t")?.as_u64()?, fields.get("i")?.as_u64()?),
        _ => return None,
    };
    Some(json!({ "$timestamp": { "t": u32::try_from(t).ok()?, "i": u32::try_from(i).ok()? } }))
}

fn is_hex(text: &str, length: usize) -> bool {
    text.len() == length && text.chars().all(|c| c.is_ascii_hexdigit())
}
