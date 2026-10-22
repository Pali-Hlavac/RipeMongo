//! Recursive-descent parser for mongosh-style values, producing Extended JSON.
//!
//! Accepts strict JSON plus: unquoted keys, single-quoted strings, trailing commas,
//! `//` and `/* */` comments, `/regex/flags`, `NaN`/`Infinity`/`undefined`, and shell
//! helpers such as `ObjectId("…")` or `new Date(…)` (see `calls.rs`).

mod calls;
mod literals;

use serde_json::{Map, Value};

use super::EjsonError;

/// Parses `text` as exactly one value.
pub fn parse(text: &str) -> Result<Value, EjsonError> {
    let mut parser = Parser {
        chars: text.chars().collect(),
        pos: 0,
    };
    parser.skip_trivia()?;
    let value = parser.value()?;
    parser.skip_trivia()?;
    if parser.pos < parser.chars.len() {
        return Err(parser.error("Unexpected text after the value"));
    }
    Ok(value)
}

pub(super) struct Parser {
    chars: Vec<char>,
    pos: usize,
}

impl Parser {
    pub(super) fn peek(&self) -> Option<char> {
        self.chars.get(self.pos).copied()
    }

    pub(super) fn peek_at(&self, offset: usize) -> Option<char> {
        self.chars.get(self.pos + offset).copied()
    }

    pub(super) fn bump(&mut self) -> Option<char> {
        let next = self.peek();
        if next.is_some() {
            self.pos += 1;
        }
        next
    }

    fn expect(&mut self, wanted: char) -> Result<(), EjsonError> {
        self.skip_trivia()?;
        if self.peek() == Some(wanted) {
            self.pos += 1;
            Ok(())
        } else {
            Err(self.error(&format!("Expected '{wanted}'")))
        }
    }

    pub(super) fn error(&self, message: &str) -> EjsonError {
        let before = &self.chars[..self.pos.min(self.chars.len())];
        let line = before.iter().filter(|c| **c == '\n').count() + 1;
        let column = before.iter().rev().take_while(|c| **c != '\n').count() + 1;
        let found = match self.peek() {
            Some(c) => format!(" near '{c}'"),
            None => " at the end".to_owned(),
        };
        EjsonError::Syntax {
            message: format!("{message}{found}"),
            line,
            column,
        }
    }

    /// Skips whitespace and comments.
    fn skip_trivia(&mut self) -> Result<(), EjsonError> {
        loop {
            match (self.peek(), self.peek_at(1)) {
                (Some(c), _) if c.is_whitespace() => self.pos += 1,
                (Some('/'), Some('/')) => {
                    while self.peek().is_some_and(|c| c != '\n') {
                        self.pos += 1;
                    }
                }
                (Some('/'), Some('*')) => {
                    self.pos += 2;
                    while !(self.peek() == Some('*') && self.peek_at(1) == Some('/')) {
                        if self.bump().is_none() {
                            return Err(self.error("Unclosed comment"));
                        }
                    }
                    self.pos += 2;
                }
                _ => return Ok(()),
            }
        }
    }

    pub(super) fn value(&mut self) -> Result<Value, EjsonError> {
        self.skip_trivia()?;
        match self.peek() {
            Some('{') => self.object(),
            Some('[') => self.array(),
            Some(quote @ ('"' | '\'')) => self.string(quote).map(Value::String),
            Some('/') => self.regex(),
            Some(c) if c == '-' || c == '+' || c == '.' || c.is_ascii_digit() => self.number(),
            Some(c) if is_word_start(c) => self.word(),
            _ => Err(self.error("Expected a value")),
        }
    }

    fn object(&mut self) -> Result<Value, EjsonError> {
        self.expect('{')?;
        let mut map = Map::new();
        loop {
            self.skip_trivia()?;
            if self.peek() == Some('}') {
                self.pos += 1;
                return Ok(Value::Object(map));
            }
            let key = self.key()?;
            self.expect(':')?;
            let value = self.value()?;
            map.insert(key, value);
            self.skip_trivia()?;
            match self.peek() {
                Some(',') => self.pos += 1,
                Some('}') => {}
                _ => return Err(self.error("Expected ',' or '}'")),
            }
        }
    }

    fn array(&mut self) -> Result<Value, EjsonError> {
        self.expect('[')?;
        let mut items = Vec::new();
        loop {
            self.skip_trivia()?;
            if self.peek() == Some(']') {
                self.pos += 1;
                return Ok(Value::Array(items));
            }
            items.push(self.value()?);
            self.skip_trivia()?;
            match self.peek() {
                Some(',') => self.pos += 1,
                Some(']') => {}
                _ => return Err(self.error("Expected ',' or ']'")),
            }
        }
    }

    /// Arguments of a helper call: `(value, value, …)`.
    pub(super) fn arguments(&mut self) -> Result<Vec<Value>, EjsonError> {
        self.expect('(')?;
        let mut args = Vec::new();
        loop {
            self.skip_trivia()?;
            if self.peek() == Some(')') {
                self.pos += 1;
                return Ok(args);
            }
            args.push(self.value()?);
            self.skip_trivia()?;
            match self.peek() {
                Some(',') => self.pos += 1,
                Some(')') => {}
                _ => return Err(self.error("Expected ',' or ')'")),
            }
        }
    }

    fn key(&mut self) -> Result<String, EjsonError> {
        match self.peek() {
            Some(quote @ ('"' | '\'')) => self.string(quote),
            Some(c) if is_key_char(c) => {
                let start = self.pos;
                while self.peek().is_some_and(is_key_char) {
                    self.pos += 1;
                }
                Ok(self.chars[start..self.pos].iter().collect())
            }
            _ => Err(self.error("Expected a field name")),
        }
    }

    pub(super) fn identifier(&mut self) -> String {
        let start = self.pos;
        while self
            .peek()
            .is_some_and(|c| c.is_ascii_alphanumeric() || c == '_' || c == '$')
        {
            self.pos += 1;
        }
        self.chars[start..self.pos].iter().collect()
    }

    fn word(&mut self) -> Result<Value, EjsonError> {
        let start = self.pos;
        let mut name = self.identifier();
        if name == "new" {
            self.skip_trivia()?;
            name = self.identifier();
        }
        let after_name = self.pos;
        self.skip_trivia()?;
        let args = if self.peek() == Some('(') {
            Some(self.arguments()?)
        } else {
            self.pos = after_name;
            None
        };
        // Errors point at the start of the word, where the user needs to look.
        let end = self.pos;
        self.pos = start;
        let value = match args {
            Some(args) => calls::call(self, &name, args)?,
            None => calls::bare_word(self, &name)?,
        };
        self.pos = end;
        Ok(value)
    }
}

fn is_word_start(c: char) -> bool {
    c.is_ascii_alphabetic() || c == '_' || c == '$'
}

fn is_key_char(c: char) -> bool {
    c.is_ascii_alphanumeric() || matches!(c, '_' | '$' | '.' | '-')
}
