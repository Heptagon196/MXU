//! Track the last FGA run on one child's stdout, so EOF cannot affect a replacement child.
#[derive(Default)]
pub(crate) struct FgaaOutputRun(Option<serde_json::Value>, bool);

impl FgaaOutputRun {
    pub(crate) fn observe(&mut self, line: &str) {
        if line.len() > 131072 {
            return;
        }
        let Ok(value) = serde_json::from_str::<serde_json::Value>(line) else {
            return;
        };
        if value["protocol"] == 1
            && value["event"] == "finished"
            && self.0.as_ref().is_some_and(|run| {
                run["runId"] == value["runId"] && run["nativeTaskId"] == value["nativeTaskId"]
            })
            && matches!(
                value["payload"]["status"].as_str(),
                Some("completed" | "failed" | "attention" | "stopped")
            )
        {
            self.1 = true;
        }
        if value["protocol"] != 1 || value["event"] != "started" || value["sequence"] != 1 {
            return;
        }
        if value["runId"].as_str().is_some_and(|id| id.len() == 36)
            && value["nativeTaskId"].as_i64().is_some()
        {
            self.0 = Some(serde_json::json!({
                "runId": value["runId"], "nativeTaskId": value["nativeTaskId"]
            }));
            self.1 = false;
        }
    }

    pub(crate) fn closed_payload(&self) -> Option<String> {
        self.0.as_ref().map(ToString::to_string)
    }

    pub(crate) fn unfinished_task_id(&self) -> Option<i64> {
        if self.1 {
            None
        } else {
            self.0.as_ref()?.get("nativeTaskId")?.as_i64()
        }
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
        assert_eq!(tracker.unfinished_task_id(), Some(8));
        tracker.observe(
            &serde_json::json!({"protocol":1,"event":"finished",
            "runId":payload["runId"],"nativeTaskId":7,"payload":{"status":"completed"}})
            .to_string(),
        );
        assert_eq!(tracker.unfinished_task_id(), Some(8));
        tracker.observe(
            &serde_json::json!({"protocol":1,"event":"finished",
            "runId":payload["runId"],"nativeTaskId":8,"payload":{"status":"completed"}})
            .to_string(),
        );
        assert_eq!(tracker.unfinished_task_id(), None);
        assert!(tracker.closed_payload().is_some());
        assert!(FgaaOutputRun::default().closed_payload().is_none());
    }
}
