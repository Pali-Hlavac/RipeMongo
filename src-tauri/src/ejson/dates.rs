//! Lenient date parsing for `ISODate("…")` / `new Date("…")`, as mongosh accepts them.

use mongodb::bson::DateTime;

/// Parses `2024-05-01`, `2024-05-01T10:30`, `2024-05-01T10:30:00.5+02:00`, … into a BSON date.
/// Missing seconds default to `:00`, a missing time to midnight and a missing zone to UTC.
pub fn parse_date(text: &str) -> Option<DateTime> {
    DateTime::parse_rfc3339_str(normalize(text.trim())).ok()
}

fn normalize(text: &str) -> String {
    let Some((date, time)) = text.split_once(['T', ' ']) else {
        return format!("{text}T00:00:00Z");
    };
    let (clock, zone) = split_zone(time);
    let clock = if clock.matches(':').count() == 1 {
        format!("{clock}:00")
    } else {
        clock.to_owned()
    };
    let zone = if zone.is_empty() { "Z" } else { zone };
    format!("{date}T{clock}{zone}")
}

fn split_zone(time: &str) -> (&str, &str) {
    if let Some(stripped) = time.strip_suffix(['Z', 'z']) {
        return (stripped, "Z");
    }
    match time.rfind(['+', '-']) {
        Some(index) => time.split_at(index),
        None => (time, ""),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn millis(text: &str) -> i64 {
        parse_date(text).unwrap().timestamp_millis()
    }

    #[test]
    fn accepts_partial_iso_dates() {
        assert_eq!(millis("1970-01-02"), 86_400_000);
        assert_eq!(millis("1970-01-01T00:01"), 60_000);
        assert_eq!(millis("1970-01-01 00:00:01"), 1_000);
        assert_eq!(millis("1970-01-01T00:00:00.250Z"), 250);
        assert_eq!(millis("1970-01-01T01:00:00+01:00"), 0);
    }

    #[test]
    fn rejects_garbage() {
        assert!(parse_date("yesterday").is_none());
        assert!(parse_date("2024-13-40").is_none());
    }
}
