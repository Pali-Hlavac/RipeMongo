//! Tests of the export request and its `mongoexport` arguments.

use super::{ExportFormat, ExportRequest};

fn request(format: ExportFormat) -> ExportRequest {
    ExportRequest {
        database: "shop".into(),
        collection: "orders".into(),
        path: std::env::temp_dir()
            .join("orders.out")
            .to_string_lossy()
            .into_owned(),
        format,
        fields: Vec::new(),
        json_array: false,
        pretty: false,
        canonical: false,
        header: true,
        query: None,
        sort: None,
        skip: None,
        limit: None,
    }
}

#[test]
fn json_export_with_every_option() {
    let mut json = request(ExportFormat::Json);
    json.json_array = true;
    json.pretty = true;
    json.canonical = true;
    json.header = false;
    json.fields = vec![" name ".into(), String::new(), "total".into()];
    json.query = Some("{ total: { $gt: 5 } }".into());
    json.sort = Some("{ total: -1 }".into());
    json.skip = Some(10);
    json.limit = Some(0);
    let args = json.args().unwrap();
    assert_eq!(&args[..2], ["--db=shop", "--collection=orders"]);
    assert_eq!(
        &args[3..],
        [
            "--jsonArray",
            "--pretty",
            "--jsonFormat=canonical",
            "--fields=name,total",
            r#"--query={"total":{"$gt":{"$numberInt":"5"}}}"#,
            r#"--sort={"total":-1}"#,
            "--skip=10",
        ]
    );
}

#[test]
fn csv_needs_fields_and_ignores_json_options() {
    let mut csv = request(ExportFormat::Csv);
    csv.pretty = true;
    assert!(csv.args().unwrap_err().to_string().contains("CSV columns"));
    csv.fields = vec!["_id".into(), "address.city".into()];
    csv.header = false;
    csv.limit = Some(5);
    let args = csv.args().unwrap();
    assert_eq!(
        &args[3..],
        [
            "--type=csv",
            "--noHeaderLine",
            "--fields=_id,address.city",
            "--limit=5"
        ]
    );
}

#[test]
fn rejects_bad_input() {
    let mut bad = request(ExportFormat::Json);
    bad.path = "relative.json".into();
    assert!(bad.args().unwrap_err().to_string().contains("full path"));
    let mut bad = request(ExportFormat::Json);
    bad.fields = vec!["a,b".into()];
    assert!(bad.args().unwrap_err().to_string().contains("comma"));
    let mut bad = request(ExportFormat::Json);
    bad.sort = Some("{ total: ".into());
    assert!(bad.args().unwrap_err().to_string().starts_with("The sort"));
    let mut blank = request(ExportFormat::Json);
    blank.query = Some(" {} ".into());
    assert_eq!(blank.args().unwrap().len(), 3);
}
