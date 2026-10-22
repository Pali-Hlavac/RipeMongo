//! Tests for shell-syntax parsing and Extended JSON conversion.

use mongodb::bson::{doc, Bson, DateTime};

use super::*;

#[test]
fn parses_strict_json_and_extended_json() {
    let doc = parse_document(r#"{"a": 1, "b": {"$numberLong": "5"}, "c": [true, null]}"#).unwrap();
    assert_eq!(doc, doc! { "a": 1, "b": 5_i64, "c": [true, Bson::Null] });
}

#[test]
fn parses_shell_syntax() {
    let doc = parse_document(
        r#"{
            // comment
            _id: ObjectId('507f1f77bcf86cd799439011'),
            name: 'Ann "the" Admin',
            'quoted key': 1.0,
            nested.path: { $gte: NumberLong(10), $lt: NumberInt("20") },
            when: ISODate("1970-01-02"),
            created: new Date(1000),
            price: NumberDecimal("9.99"),
            tags: ['a', 'b',],   /* trailing comma */
            neg: -5,
        }"#,
    )
    .unwrap();
    assert_eq!(
        doc.get_object_id("_id").unwrap().to_hex(),
        "507f1f77bcf86cd799439011"
    );
    assert_eq!(doc.get_str("name").unwrap(), "Ann \"the\" Admin");
    assert_eq!(doc.get("quoted key"), Some(&Bson::Double(1.0)));
    assert_eq!(
        doc.get_document("nested.path").unwrap(),
        &doc! { "$gte": 10_i64, "$lt": 20 }
    );
    assert_eq!(
        doc.get_datetime("when").unwrap(),
        &DateTime::from_millis(86_400_000)
    );
    assert_eq!(
        doc.get_datetime("created").unwrap(),
        &DateTime::from_millis(1000)
    );
    assert!(matches!(doc.get("price"), Some(Bson::Decimal128(_))));
    assert_eq!(doc.get_i32("neg").unwrap(), -5);
    assert_eq!(doc.get_array("tags").unwrap().len(), 2);
}

#[test]
fn keeps_field_order() {
    let doc = parse_document("{ z: 1, a: 2, m: 3 }").unwrap();
    let keys: Vec<_> = doc.keys().collect();
    assert_eq!(keys, ["z", "a", "m"]);
}

#[test]
fn parses_regex_uuid_and_special_values() {
    let doc = parse_document(
        r#"{ r: /^ab[/c]\/d/mi, u: UUID("123e4567-e89b-12d3-a456-426614174000"),
             b: BinData(0, "AQID"), t: Timestamp(5, 1), n: NaN, i: -Infinity,
             lo: MinKey, hi: MaxKey(), x: undefined }"#,
    )
    .unwrap();
    match doc.get("r") {
        Some(Bson::RegularExpression(regex)) => {
            assert_eq!(regex.pattern, r"^ab[/c]\/d");
            assert_eq!(regex.options, "im");
        }
        other => panic!("expected regex, got {other:?}"),
    }
    match doc.get("u") {
        Some(Bson::Binary(binary)) => assert_eq!(binary.bytes.len(), 16),
        other => panic!("expected binary, got {other:?}"),
    }
    assert!(matches!(doc.get("t"), Some(Bson::Timestamp(_))));
    assert!(matches!(doc.get("n"), Some(Bson::Double(n)) if n.is_nan()));
    assert_eq!(doc.get("i"), Some(&Bson::Double(f64::NEG_INFINITY)));
    assert_eq!(doc.get("lo"), Some(&Bson::MinKey));
    assert_eq!(doc.get("hi"), Some(&Bson::MaxKey));
    assert_eq!(doc.get("x"), Some(&Bson::Undefined));
}

#[test]
fn blank_input_is_an_empty_document() {
    assert_eq!(parse_document("  \n ").unwrap(), doc! {});
}

#[test]
fn parses_documents_and_arrays_of_documents() {
    assert_eq!(parse_documents("{a: 1}").unwrap().len(), 1);
    assert_eq!(parse_documents("[{a: 1}, {b: 2}]").unwrap().len(), 2);
    assert!(matches!(
        parse_documents("[1, 2]"),
        Err(EjsonError::Expected { .. })
    ));
}

#[test]
fn reports_errors_with_position() {
    let error = parse_document("{\n  a: 1,\n  b: oops\n}").unwrap_err();
    assert!(
        matches!(
            &error,
            EjsonError::Syntax {
                line: 3,
                column: 6,
                ..
            }
        ),
        "{error:?}"
    );
    assert!(error.to_string().contains("oops"));

    assert!(matches!(
        parse_document("{a: 1"),
        Err(EjsonError::Syntax { .. })
    ));
    assert!(matches!(
        parse_document("{a: 'x}"),
        Err(EjsonError::Syntax { .. })
    ));
    assert!(matches!(
        parse_document("{a: ObjectId('xyz')}"),
        Err(EjsonError::Syntax { .. })
    ));
    assert!(matches!(
        parse_document("{a: Foo(1)}"),
        Err(EjsonError::Syntax { .. })
    ));
    assert!(matches!(
        parse_document("[1]"),
        Err(EjsonError::Expected { .. })
    ));
    assert!(matches!(
        parse_document("{a: 1} {b: 2}"),
        Err(EjsonError::Syntax { .. })
    ));
}

#[test]
fn canonical_output_round_trips_every_type() {
    let original = parse_document(
        r#"{ i: 1, l: NumberLong(2), d: 3.5, whole: 4.0, dec: NumberDecimal("1.10"),
             s: "x", o: ObjectId("507f1f77bcf86cd799439011"), dt: ISODate("2024-01-01"),
             r: /a/i, u: UUID("123e4567e89b12d3a456426614174000") }"#,
    )
    .unwrap();
    let json = to_canonical_json(original.clone());
    assert!(json.contains(r#""i":{"$numberInt":"1"}"#), "{json}");
    assert!(
        json.contains(r#""whole":{"$numberDouble":"4.0"}"#),
        "{json}"
    );
    assert_eq!(parse_document(&json).unwrap(), original);
}

/// The frontend's JSON view (`documents/lib/format.ts` `toShell`) must read back losslessly;
/// this is the exact text its test produces.
#[test]
fn frontend_shell_output_round_trips_to_canonical_json() {
    let shell = r#"{
  _id: ObjectId("65a1b2c3d4e5f60718293a4b"),
  n: 7,
  big: NumberLong("9007199254740993"),
  price: 2.0,
  dec: NumberDecimal("0.1"),
  at: ISODate("2024-01-01T00:00:00.000Z"),
  id: UUID("01234567-89ab-cdef-0123-456789abcdef"),
  re: RegExp("^a/b", "i"),
  ts: Timestamp(1, 2),
  tags: [
    "x",
    1
  ],
  nested: {
    "weird key": null,
    ok: true
  }
}"#;
    let canonical = concat!(
        r#"{"_id":{"$oid":"65a1b2c3d4e5f60718293a4b"},"n":{"$numberInt":"7"},"#,
        r#""big":{"$numberLong":"9007199254740993"},"price":{"$numberDouble":"2.0"},"#,
        r#""dec":{"$numberDecimal":"0.1"},"at":{"$date":{"$numberLong":"1704067200000"}},"#,
        r#""id":{"$binary":{"base64":"ASNFZ4mrze8BI0VniavN7w==","subType":"04"}},"#,
        r#""re":{"$regularExpression":{"pattern":"^a/b","options":"i"}},"#,
        r#""ts":{"$timestamp":{"t":1,"i":2}},"tags":["x",{"$numberInt":"1"}],"#,
        r#""nested":{"weird key":null,"ok":true}}"#
    );
    assert_eq!(to_canonical_json(parse_document(shell).unwrap()), canonical);
}
