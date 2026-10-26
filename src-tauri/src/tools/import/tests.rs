//! Tests of the import request, its `mongoimport` arguments and reading files before import.

use super::*;

fn absolute(name: &str) -> String {
    std::env::temp_dir()
        .join(name)
        .to_string_lossy()
        .into_owned()
}

fn column(field: &str, kind: ColumnType) -> ImportColumn {
    ImportColumn {
        include: true,
        field: field.into(),
        kind,
        date_format: String::new(),
    }
}

fn request(format: ImportFormat) -> ImportRequest {
    ImportRequest {
        database: "shop".into(),
        collection: "people".into(),
        path: absolute("people.csv"),
        format,
        delimiter: ";".into(),
        header: true,
        columns: vec![
            column("zip", ColumnType::String),
            column("born", ColumnType::Date),
            column("note", ColumnType::Auto),
        ],
        ignore_blanks: false,
        parse_errors: ParseErrors::Stop,
        mode: ImportMode::Insert,
        match_fields: Vec::new(),
        drop: false,
        stop_on_error: false,
        insertion_workers: None,
        bypass_validation: false,
    }
}

#[test]
fn json_imports_read_the_file_directly() {
    let mut json = request(ImportFormat::JsonArray);
    json.mode = ImportMode::Merge;
    json.match_fields = vec![" email ".into(), String::new()];
    json.drop = true;
    json.stop_on_error = true;
    json.insertion_workers = Some(MAX_INSERTION_WORKERS);
    json.bypass_validation = true;
    json.ignore_blanks = true;
    let args = json.args().unwrap();
    assert_eq!(&args[..2], ["--db=shop", "--collection=people"]);
    assert_eq!(
        &args[3..],
        [
            "--jsonArray",
            "--mode=merge",
            "--upsertFields=email",
            "--drop",
            "--stopOnError",
            "--numInsertionWorkers=16",
            "--bypassDocumentValidation"
        ]
    );
    assert!(args[2].starts_with("--file="));
    assert_eq!(
        request(ImportFormat::Json).title(),
        "Import people.csv into shop.people"
    );
}

#[test]
fn csv_imports_pass_typed_fields_for_included_columns() {
    let mut csv = request(ImportFormat::Csv);
    csv.columns[1].date_format = "dd.MM.yyyy".into();
    csv.columns[2].include = false;
    csv.ignore_blanks = true;
    csv.parse_errors = ParseErrors::SkipRow;
    csv.mode = ImportMode::Upsert;
    assert_eq!(
        csv.args().unwrap()[2..],
        [
            "--type=csv",
            "--columnsHaveTypes",
            "--fields=zip.string(),born.date_ms(dd.MM.yyyy)",
            "--ignoreBlanks",
            "--parseGrace=skipRow",
            "--mode=upsert"
        ]
    );
    assert_eq!(csv.included_columns(), [0, 1]);
    assert_eq!(csv.delimiter_byte().unwrap(), b';');
}

#[test]
fn rejects_bad_names_and_settings() {
    let error = |change: &dyn Fn(&mut ImportRequest)| {
        let mut bad = request(ImportFormat::Csv);
        bad.columns[1].date_format = "yyyy".into();
        change(&mut bad);
        bad.args().unwrap_err().to_string()
    };
    assert!(error(&|r| r.collection = " ".into()).contains("Enter the collection"));
    assert!(error(&|r| r.collection = "system.x".into()).contains("cannot be a collection"));
    assert!(error(&|r| r.path = "people.csv".into()).contains("full path"));
    assert!(error(&|r| r.delimiter = ";;".into()).contains("one character"));
    assert!(error(&|r| r.columns[0].field = "a(b)".into()).contains("cannot be a field name"));
    assert!(error(&|r| r.columns[2].field = "zip".into()).contains("Two columns"));
    assert!(error(&|r| r.columns[0].field = " ".into()).contains("needs a field name"));
    assert!(error(&|r| r.columns[1].date_format = String::new()).contains("date format"));
    for workers in [0, MAX_INSERTION_WORKERS + 1] {
        assert!(error(&|r| r.insertion_workers = Some(workers)).contains("insert workers"));
    }
    assert!(
        error(&|r| r.columns.iter_mut().for_each(|c| c.include = false))
            .contains("at least one column")
    );
}

#[test]
fn previews_delimited_text_and_json() {
    let dir = tempfile::tempdir().unwrap();
    let csv = dir.path().join("people.csv");
    std::fs::write(
        &csv,
        "\u{feff}zip;born;note\n01234;05.03.2024;\"a; b\"\n00042;31.12.2024;x\n",
    )
    .unwrap();
    let path = csv.to_string_lossy();
    let preview = inspect_import_file(&path, None).unwrap();
    assert_eq!(preview.format, ImportFormat::Csv);
    assert_eq!(preview.delimiter, ";");
    let firsts: Vec<&str> = preview.columns.iter().map(|c| c.first.as_str()).collect();
    assert_eq!(firsts, ["zip", "born", "note"]);
    assert_eq!(preview.columns[2].samples, ["a; b", "x"]);
    assert_eq!(preview.columns[0].suggestion.kind, ColumnType::String);
    assert_eq!(preview.columns[1].suggestion.date_format, "dd.MM.yyyy");
    // Another delimiter makes one column.
    let commas = inspect_import_file(&path, Some(",")).unwrap();
    assert_eq!(commas.delimiter, ",");
    assert_eq!(commas.columns.len(), 1);

    let lines = dir.path().join("a.json");
    std::fs::write(&lines, "\n {\"a\":1}\n").unwrap();
    let array = dir.path().join("b.json");
    std::fs::write(&array, "[{\"a\":1}]").unwrap();
    let empty = dir.path().join("c.csv");
    std::fs::write(&empty, " \n").unwrap();
    let format = |path: &std::path::Path| inspect_import_file(&path.to_string_lossy(), None);
    assert_eq!(format(&lines).unwrap().format, ImportFormat::Json);
    assert_eq!(format(&array).unwrap().format, ImportFormat::JsonArray);
    assert!(format(&empty).unwrap_err().to_string().contains("empty"));
    assert!(inspect_import_file("relative.csv", None).is_err());
}

fn kind(values: &[&str]) -> ColumnType {
    suggest_type(values.iter().copied()).kind
}

#[test]
fn suggests_types_that_keep_values_intact() {
    assert_eq!(kind(&["1", "-20", ""]), ColumnType::Auto);
    assert_eq!(kind(&["01234", "12345"]), ColumnType::String);
    assert_eq!(kind(&["true", "FALSE"]), ColumnType::Boolean);
    assert_eq!(kind(&["1", "0"]), ColumnType::Auto);
    assert_eq!(
        kind(&["2024-03-05T10:20:30Z", "2024-03-05T10:20:30.123+02:00"]),
        ColumnType::IsoDate
    );
    assert_eq!(kind(&["2024-03-05T10:20:30"]), ColumnType::IsoLocalDate);
    assert_eq!(kind(&["2024-03-05", "hello"]), ColumnType::Auto);
    assert_eq!(kind(&[" ", ""]), ColumnType::Auto);
    let date = suggest_type(["05.03.2024", "31.12.2024"]);
    assert_eq!(
        (date.kind, date.date_format.as_str()),
        (ColumnType::Date, "dd.MM.yyyy")
    );
    let mixed = suggest_type(["2024-03-05", "05.03.2024"]);
    assert_eq!(mixed.kind, ColumnType::Auto);
}

#[test]
fn builds_mongoimport_type_specs() {
    assert_eq!(ColumnType::String.spec("").unwrap(), "string()");
    assert_eq!(
        ColumnType::IsoDate.spec("").unwrap(),
        "date_go(2006-01-02T15:04:05Z07:00)"
    );
    assert_eq!(
        ColumnType::Date.spec("dd.MM.yyyy").unwrap(),
        "date_ms(dd.MM.yyyy)"
    );
    assert!(ColumnType::Date.spec("").is_err());
    assert!(ColumnType::Date.spec("dd,MM").is_err());
    assert_eq!(ColumnType::Hex.spec("").unwrap(), "binary(hex)");
}
