//! Text helpers shared by the tool output parsers: namespaces as the tools print them, sizes
//! in progress lines ("12.7MB") and counts in job summaries ("1 document", "1,204 documents").

/// Size units in the tools' progress bars ("12.7MB"), largest first; powers of 1024.
const SIZE_UNITS: [(&str, f64); 5] = [
    ("TB", 1_099_511_627_776.0),
    ("GB", 1_073_741_824.0),
    ("MB", 1_048_576.0),
    ("KB", 1024.0),
    ("B", 1.0),
];

/// Recent tools quote names in messages (`` `shop.items` ``) but not in progress bars.
pub fn clean_namespace(namespace: &str) -> &str {
    namespace.trim().trim_matches('`')
}

/// "12.7MB" → bytes. `None` for anything else.
pub fn parse_size(text: &str) -> Option<f64> {
    let (unit, factor) = SIZE_UNITS.iter().find(|(unit, _)| text.ends_with(unit))?;
    let number: f64 = text.strip_suffix(unit)?.parse().ok()?;
    number.is_finite().then_some(number * factor)
}

/// 1204 → "1,204".
pub fn thousands(value: f64) -> String {
    let digits = format!("{value:.0}");
    let mut grouped = String::with_capacity(digits.len() + digits.len() / 3);
    for (index, digit) in digits.chars().enumerate() {
        if index > 0 && (digits.len() - index) % 3 == 0 {
            grouped.push(',');
        }
        grouped.push(digit);
    }
    grouped
}

/// `count(1.0, "document", "documents")` → "1 document"; otherwise "1,204 documents".
pub fn count(value: f64, one: &str, many: &str) -> String {
    if value == 1.0 {
        format!("1 {one}")
    } else {
        format!("{} {many}", thousands(value))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn groups_thousands_and_picks_the_noun() {
        assert_eq!(thousands(0.0), "0");
        assert_eq!(thousands(999.0), "999");
        assert_eq!(thousands(1_234_567.0), "1,234,567");
        assert_eq!(count(1.0, "entry", "entries"), "1 entry");
        assert_eq!(count(2_000.0, "entry", "entries"), "2,000 entries");
    }

    #[test]
    fn strips_quotes_from_namespaces() {
        assert_eq!(clean_namespace(" `shop.items` "), "shop.items");
        assert_eq!(clean_namespace("shop.items"), "shop.items");
    }
}
