//! Track the last FGA run on one child's stdout, so EOF cannot affect a replacement child.
#[derive(Default)]
pub(crate) struct FgaaOutputRun(Option<serde_json::Value>);

impl FgaaOutputRun {
    pub(crate) fn observe(&mut self, line: &str) {
        if line.len() > 131072 {
            return;
        }
        let Ok(value) = serde_json::from_str::<serde_json::Value>(line) else {
            return;
        };
        if value["protocol"] != 1 || value["event"] != "started" || value["sequence"] != 1 {
            return;
        }
        if value["runId"].as_str().is_some_and(|id| id.len() == 36)
            && value["nativeTaskId"].as_i64().is_some()
        {
            self.0 = Some(serde_json::json!({
                "runId": value["runId"], "nativeTaskId": value["nativeTaskId"]
            }));
        }
    }

    pub(crate) fn closed_payload(&self) -> Option<String> {
        self.0.as_ref().map(ToString::to_string)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn closure_identifies_only_this_childs_latest_run() {
        let mut tracker = FgaaOutputRun::default();
        tracker.observe("ordinary output");
        tracker.observe(r#"{"protocol":1,"event":"ready"}"#);
        assert!(tracker.closed_payload().is_none());
        for task in [7, 8] {
            tracker.observe(
                &serde_json::json!({"protocol":1,"event":"started","sequence":1,
                "runId":"12345678-1234-1234-1234-123456789abc","nativeTaskId":task})
                .to_string(),
            );
        }
        tracker.observe(r#"{"protocol":2,"event":"started","sequence":1}"#);
        let payload: serde_json::Value =
            serde_json::from_str(&tracker.closed_payload().unwrap()).unwrap();
        assert_eq!(payload["nativeTaskId"], 8);
        assert!(FgaaOutputRun::default().closed_payload().is_none());
    }
}
