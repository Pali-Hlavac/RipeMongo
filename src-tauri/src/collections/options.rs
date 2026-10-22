//! Validates UI collection options and converts them into driver options.

use std::time::Duration;

use mongodb::options::{CreateCollectionOptions, TimeseriesGranularity, TimeseriesOptions};

use super::{NewCollectionOptions, TimeSeriesGranularity};
use crate::mongo::MongoError;

/// Converts a non-negative whole number coming from JS into `u64`.
fn whole_number(value: f64, what: &str) -> Result<u64, MongoError> {
    if !value.is_finite() || value < 0.0 || value.fract() != 0.0 || value > u64::MAX as f64 {
        return Err(MongoError::Invalid(format!(
            "{what} must be a whole number of 0 or more."
        )));
    }
    // Checked above: finite, non-negative, integral and within range.
    #[allow(clippy::cast_possible_truncation, clippy::cast_sign_loss)]
    Ok(value as u64)
}

/// Driver options for a new collection.
pub fn create_options(
    options: &NewCollectionOptions,
) -> Result<CreateCollectionOptions, MongoError> {
    let mut driver = CreateCollectionOptions::default();
    match options {
        NewCollectionOptions::Standard => {}
        NewCollectionOptions::Capped {
            size_bytes,
            max_documents,
        } => {
            let size = whole_number(*size_bytes, "The maximum size")?;
            if size == 0 {
                return Err(MongoError::Invalid(
                    "A capped collection needs a maximum size above 0 bytes.".into(),
                ));
            }
            driver.capped = Some(true);
            driver.size = Some(size);
            driver.max = max_documents
                .map(|max| whole_number(max, "The maximum number of documents"))
                .transpose()?;
        }
        NewCollectionOptions::TimeSeries {
            time_field,
            meta_field,
            granularity,
            expire_after_seconds,
        } => {
            if time_field.trim().is_empty() {
                return Err(MongoError::Invalid(
                    "A time-series collection needs a time field.".into(),
                ));
            }
            driver.timeseries = Some(
                TimeseriesOptions::builder()
                    .time_field(time_field.clone())
                    .meta_field(meta_field.clone().filter(|field| !field.trim().is_empty()))
                    .granularity(granularity.map(driver_granularity))
                    .build(),
            );
            driver.expire_after_seconds = expire_after_seconds
                .map(|seconds| whole_number(seconds, "Expire after").map(Duration::from_secs))
                .transpose()?;
        }
    }
    Ok(driver)
}

fn driver_granularity(granularity: TimeSeriesGranularity) -> TimeseriesGranularity {
    match granularity {
        TimeSeriesGranularity::Seconds => TimeseriesGranularity::Seconds,
        TimeSeriesGranularity::Minutes => TimeseriesGranularity::Minutes,
        TimeSeriesGranularity::Hours => TimeseriesGranularity::Hours,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn capped_requires_positive_whole_size() {
        let ok = create_options(&NewCollectionOptions::Capped {
            size_bytes: 4096.0,
            max_documents: Some(100.0),
        })
        .unwrap();
        assert_eq!(
            (ok.capped, ok.size, ok.max),
            (Some(true), Some(4096), Some(100))
        );

        for size in [0.0, -1.0, 1.5, f64::NAN] {
            let result = create_options(&NewCollectionOptions::Capped {
                size_bytes: size,
                max_documents: None,
            });
            assert!(result.is_err(), "{size}");
        }
    }

    #[test]
    fn time_series_maps_fields_and_expiry() {
        let options = create_options(&NewCollectionOptions::TimeSeries {
            time_field: "ts".into(),
            meta_field: Some(" ".into()),
            granularity: Some(TimeSeriesGranularity::Minutes),
            expire_after_seconds: Some(3600.0),
        })
        .unwrap();
        let timeseries = options.timeseries.unwrap();
        assert_eq!(timeseries.time_field, "ts");
        assert_eq!(timeseries.meta_field, None);
        assert_eq!(timeseries.granularity, Some(TimeseriesGranularity::Minutes));
        assert_eq!(
            options.expire_after_seconds,
            Some(Duration::from_secs(3600))
        );
    }

    #[test]
    fn time_series_requires_time_field() {
        let result = create_options(&NewCollectionOptions::TimeSeries {
            time_field: String::new(),
            meta_field: None,
            granularity: None,
            expire_after_seconds: None,
        });
        assert!(result.is_err());
    }
}
