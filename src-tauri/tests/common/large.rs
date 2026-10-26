//! Helpers for the opt-in large-file import test: generated files of several GB (never
//! committed) and memory samples of the test process and its `mongoimport` child.

use std::fs::File;
use std::io::{BufWriter, Write};
use std::path::{Path, PathBuf};

use sysinfo::{Pid, ProcessRefreshKind, ProcessesToUpdate, System};

const CITIES: [&str; 6] = [
    "Bratislava",
    "Košice",
    "Prešov",
    "Žilina",
    "Nitra",
    "Banská Bystrica",
];
/// Text that makes a document a few hundred bytes, like a real order with a note.
const NOTE: &str = "Delivered to the side entrance; the customer asked for a call before \
                    arrival and for the invoice by e-mail. Packed in two boxes, one of them \
                    fragile, with a printed receipt and a voucher for the next order.";
const WRITE_BUFFER: usize = 1 << 20;
/// Parameters of a linear congruential generator: varied values, the same every run.
const LCG_MULTIPLIER: u64 = 6_364_136_223_846_793_005;
const LCG_INCREMENT: u64 = 1_442_695_040_888_963_407;
const CENTS: u64 = 100_000;
const SECONDS_IN_2024: u64 = 31_536_000;
const START_OF_2024: i64 = 1_704_067_200;

/// The same documents as JSON lines and as a CSV file with a header line.
pub struct LargeFiles {
    pub json: PathBuf,
    pub csv: PathBuf,
    pub documents: u64,
    pub json_bytes: u64,
    pub csv_bytes: u64,
}

/// Writes documents until the JSON file reaches `bytes`.
pub fn generate(dir: &Path, bytes: u64) -> std::io::Result<LargeFiles> {
    let json_path = dir.join("large.json");
    let csv_path = dir.join("large.csv");
    let mut json = BufWriter::with_capacity(WRITE_BUFFER, File::create(&json_path)?);
    let mut csv = BufWriter::with_capacity(WRITE_BUFFER, File::create(&csv_path)?);
    writeln!(csv, "_id,name,city,total,created,note")?;
    let (mut json_bytes, mut csv_bytes, mut documents) = (0_u64, 0_u64, 0_u64);
    let mut seed = 1_u64;
    while json_bytes < bytes {
        seed = seed
            .wrapping_mul(LCG_MULTIPLIER)
            .wrapping_add(LCG_INCREMENT);
        let id = documents;
        let city = CITIES[usize::try_from(seed >> 61).unwrap_or(0) % CITIES.len()];
        let cents = (seed >> 20) % CENTS;
        let total = format!("{}.{:02}", cents / 100, cents % 100);
        let offset = i64::try_from((seed >> 8) % SECONDS_IN_2024).unwrap_or(0);
        let created = iso_date(START_OF_2024 + offset);
        let json_line = format!(
            "{{\"_id\":{id},\"name\":\"Customer {id}\",\"city\":\"{city}\",\"total\":{total},\
             \"created\":{{\"$date\":\"{created}\"}},\"note\":\"{NOTE}\"}}\n"
        );
        let csv_line = format!("{id},Customer {id},{city},{total},{created},\"{NOTE}\"\n");
        json.write_all(json_line.as_bytes())?;
        csv.write_all(csv_line.as_bytes())?;
        json_bytes += json_line.len() as u64;
        csv_bytes += csv_line.len() as u64;
        documents += 1;
    }
    json.flush()?;
    csv.flush()?;
    Ok(LargeFiles {
        json: json_path,
        csv: csv_path,
        documents,
        json_bytes,
        csv_bytes,
    })
}

/// `2024-03-05T10:20:30Z` for seconds since the Unix epoch (2024 only).
fn iso_date(seconds: i64) -> String {
    const DAY: i64 = 86_400;
    // Days in each month of 2024, a leap year.
    const MONTHS: [i64; 12] = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    let mut day = (seconds - START_OF_2024) / DAY;
    let time = (seconds - START_OF_2024) % DAY;
    let mut month = 0;
    while day >= MONTHS[month] {
        day -= MONTHS[month];
        month += 1;
    }
    format!(
        "2024-{:02}-{:02}T{:02}:{:02}:{:02}Z",
        month + 1,
        day + 1,
        time / 3600,
        time % 3600 / 60,
        time % 60
    )
}

/// Memory of this process and of the `mongoimport` it started.
pub struct MemorySampler {
    system: System,
    own: Pid,
}

/// Resident memory in bytes at one moment.
#[derive(Clone, Copy, Default)]
pub struct MemorySample {
    pub own: u64,
    /// Zero when no `mongoimport` runs.
    pub tool: u64,
}

impl MemorySampler {
    pub fn new() -> Self {
        Self {
            system: System::new(),
            own: Pid::from_u32(std::process::id()),
        }
    }

    pub fn sample(&mut self) -> MemorySample {
        self.system.refresh_processes_specifics(
            ProcessesToUpdate::All,
            true,
            ProcessRefreshKind::nothing().with_memory(),
        );
        let own = self
            .system
            .process(self.own)
            .map_or(0, |process| process.memory());
        let tool = self
            .system
            .processes()
            .values()
            .filter(|process| {
                process.parent() == Some(self.own)
                    && process.name().to_string_lossy().contains("mongoimport")
            })
            .map(|process| process.memory())
            .sum();
        MemorySample { own, tool }
    }
}
