//! Passes a delimited text file to mongoimport as plain CSV on its standard input: any
//! delimiter, without the header line, without the columns left out, without a byte order
//! mark. mongoimport itself only reads commas or tabs and cannot skip a header while it takes
//! typed field names.

use std::fs::File;
use std::io::{BufReader, Read, Write};
use std::path::PathBuf;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;

use super::preview::BOM;

/// A CSV file to rewrite for mongoimport.
pub struct CsvFeed {
    pub path: PathBuf,
    pub delimiter: u8,
    /// Skip the first row.
    pub header: bool,
    /// Indices of the columns to pass on, in order.
    pub columns: Vec<usize>,
    /// Bytes of the file read so far, for progress.
    pub read: Arc<AtomicU64>,
}

impl CsvFeed {
    /// Writes the rows to `out`. Errors are messages for the user.
    pub fn run(self, out: &mut dyn Write) -> Result<(), String> {
        let name = self.path.display().to_string();
        let file =
            File::open(&self.path).map_err(|error| format!("Could not read {name}: {error}"))?;
        let counting = Counting {
            inner: BufReader::new(file),
            read: self.read,
        };
        let mut reader = csv::ReaderBuilder::new()
            .delimiter(self.delimiter)
            .has_headers(false)
            .flexible(true)
            .from_reader(counting);
        let mut writer = csv::Writer::from_writer(out);
        let mut record = csv::ByteRecord::new();
        let mut row = csv::ByteRecord::new();
        let mut first = true;
        loop {
            match reader.read_byte_record(&mut record) {
                Ok(true) => {}
                Ok(false) => break,
                Err(error) => return Err(format!("Could not read {name}: {error}")),
            }
            let first_row = std::mem::take(&mut first);
            if first_row && self.header {
                continue;
            }
            row.clear();
            for &index in &self.columns {
                let field = record.get(index).unwrap_or_default();
                let field = if first_row && index == 0 {
                    field.strip_prefix(BOM).unwrap_or(field)
                } else {
                    field
                };
                row.push_field(field);
            }
            writer
                .write_byte_record(&row)
                .map_err(|error| format!("Could not pass {name} on: {error}"))?;
        }
        writer
            .flush()
            .map_err(|error| format!("Could not pass {name} on: {error}"))
    }
}

/// Counts the bytes read from the file.
struct Counting<R> {
    inner: R,
    read: Arc<AtomicU64>,
}

impl<R: Read> Read for Counting<R> {
    fn read(&mut self, buf: &mut [u8]) -> std::io::Result<usize> {
        let read = self.inner.read(buf)?;
        self.read.fetch_add(read as u64, Ordering::Relaxed);
        Ok(read)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn feed(content: &[u8], header: bool, columns: Vec<usize>, delimiter: u8) -> String {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("in.csv");
        std::fs::write(&path, content).unwrap();
        let read = Arc::new(AtomicU64::new(0));
        let mut out = Vec::new();
        CsvFeed {
            path,
            delimiter,
            header,
            columns,
            read: Arc::clone(&read),
        }
        .run(&mut out)
        .unwrap();
        assert_eq!(read.load(Ordering::Relaxed), content.len() as u64);
        String::from_utf8(out).unwrap()
    }

    #[test]
    fn rewrites_rows_without_header_and_left_out_columns() {
        let content = b"\xEF\xBB\xBFzip;name;note\n01234;Ann;\"a, b; c\"\n00042;Bob\n";
        assert_eq!(
            feed(content, true, vec![0, 2], b';'),
            "01234,\"a, b; c\"\n00042,\n"
        );
        assert_eq!(feed(content, false, vec![0], b';'), "zip\n01234\n00042\n");
    }

    #[test]
    fn keeps_quoted_line_breaks_and_tabs() {
        let content = b"a\tb\n\"x\ny\"\t2\n";
        assert_eq!(feed(content, true, vec![0, 1], b'\t'), "\"x\ny\",2\n");
    }
}
