//! Text helpers shared by the tool output parsers: namespaces as the tools print them, and
//! counts in job summaries ("1 document", "1,204 documents").

/// Recent tools quote names in messages (`` `shop.items` ``) but not in progress bars.
pub fn clean_namespace(namespace: &str) -> &str {
    namespace.trim().trim_matches('`')
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
