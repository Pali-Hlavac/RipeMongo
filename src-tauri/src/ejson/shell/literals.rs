//! Literal values: strings with escapes, numbers (incl. `Infinity`) and `/regex/flags`.

use serde_json::{Number, Value};

use super::{calls, Parser};
use crate::ejson::EjsonError;

impl Parser {
    pub(super) fn string(&mut self, quote: char) -> Result<String, EjsonError> {
        self.pos += 1;
        let mut out = String::new();
        loop {
            match self.bump() {
                None => return Err(self.error("Unclosed string")),
                Some(c) if c == quote => return Ok(out),
                Some('\\') => out.push(self.escape()?),
                Some(c) => out.push(c),
            }
        }
    }

    fn escape(&mut self) -> Result<char, EjsonError> {
        Ok(match self.bump() {
            Some('n') => '\n',
            Some('t') => '\t',
            Some('r') => '\r',
            Some('b') => '\u{8}',
            Some('f') => '\u{c}',
            Some('0') => '\0',
            Some('u') => return self.unicode_escape(),
            Some(c) => c,
            None => return Err(self.error("Unfinished escape sequence")),
        })
    }

    fn unicode_escape(&mut self) -> Result<char, EjsonError> {
        let first = self.hex4()?;
        if (0xD800..0xDC00).contains(&first)
            && self.peek() == Some('\\')
            && self.peek_at(1) == Some('u')
        {
            self.pos += 2;
            let second = self.hex4()?;
            let combined =
                0x10000 + ((first - 0xD800) << 10) + (second.wrapping_sub(0xDC00) & 0x3FF);
            return char::from_u32(combined).ok_or_else(|| self.error("Invalid unicode escape"));
        }
        char::from_u32(first).ok_or_else(|| self.error("Invalid unicode escape"))
    }

    fn hex4(&mut self) -> Result<u32, EjsonError> {
        let digits: String = (0..4).filter_map(|_| self.bump()).collect();
        u32::from_str_radix(&digits, 16).map_err(|_| self.error("Invalid \\u escape"))
    }

    pub(super) fn number(&mut self) -> Result<Value, EjsonError> {
        let start = self.pos;
        if matches!(self.peek(), Some('-' | '+')) {
            self.pos += 1;
        }
        if self.peek() == Some('I') {
            let negative = self.chars[start] == '-';
            let word = self.identifier();
            if word != "Infinity" {
                return Err(self.error("Expected a number"));
            }
            let text = if negative { "-Infinity" } else { "Infinity" };
            return Ok(calls::number_double(text));
        }
        while self
            .peek()
            .is_some_and(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | '-' | '+'))
        {
            if matches!(self.peek(), Some('-' | '+'))
                && !matches!(self.chars[self.pos - 1], 'e' | 'E')
            {
                break;
            }
            self.pos += 1;
        }
        let raw: String = self.chars[start..self.pos].iter().collect();
        let raw = raw.strip_prefix('+').unwrap_or(&raw);
        if let Ok(integer) = raw.parse::<i64>() {
            return Ok(Value::Number(integer.into()));
        }
        raw.parse::<f64>()
            .ok()
            .and_then(Number::from_f64)
            .map(Value::Number)
            .ok_or_else(|| self.error(&format!("'{raw}' is not a valid number")))
    }

    pub(super) fn regex(&mut self) -> Result<Value, EjsonError> {
        self.pos += 1;
        let mut pattern = String::new();
        let mut in_class = false;
        loop {
            match self.bump() {
                None | Some('\n') => return Err(self.error("Unclosed regular expression")),
                Some('/') if !in_class => break,
                Some('\\') => {
                    pattern.push('\\');
                    if let Some(next) = self.bump() {
                        pattern.push(next);
                    }
                }
                Some(c) => {
                    in_class = match c {
                        '[' => true,
                        ']' => false,
                        _ => in_class,
                    };
                    pattern.push(c);
                }
            }
        }
        let flags = self.identifier();
        Ok(calls::regular_expression(&pattern, &flags))
    }
}
