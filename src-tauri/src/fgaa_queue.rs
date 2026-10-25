//! FGA failures stop the remaining queue; never apply an old run's failure to a new run.
use crate::commands::types::TaskRunState;

pub(crate) fn completed(detail: &maa_framework::common::TaskDetail) -> bool {
    !detail.nodes.is_empty()
        && detail.nodes.iter().all(|node| {
            node.as_ref().is_some_and(|node| {
                node.completed && node.action.as_ref().is_some_and(|action| action.success)
            })
        })
}

pub(crate) fn is_fgaa_entry(entry: &str) -> bool {
    matches!(
        entry,
        "FGAA_Battle"
            | "FGAA_FP"
            | "FGAA_Lottery"
            | "FGAA_PresentBox"
            | "FGAA_SupportImageMaker"
            | "FGAA_ServantLevel"
            | "FGAA_CEBomb"
    )
}

pub(crate) fn is_active(state: &TaskRunState, task_id: i64) -> bool {
    state.overall_status.as_deref() == Some("Running")
        && state.pending_task_ids.contains(&task_id)
        && state
            .mappings
            .get(&task_id)
            .and_then(|id| state.statuses.get(id))
            .is_some_and(|status| status == "pending" || status == "running")
}

pub(crate) fn abort(state: &mut TaskRunState, task_id: i64) -> bool {
    if !is_active(state, task_id) {
        return false;
    }
    for (&id, selected) in &state.mappings {
        if let Some(status) = state.statuses.get_mut(selected) {
            if status == "pending" || status == "running" {
                *status = "failed".to_string();
                state.fgaa_cancelled_ids.push(id);
            }
        }
    }
    state.overall_status = Some("Failed".to_string());
    true
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn native_success_status_is_insufficient_without_completed_action() {
        use maa_framework::common::{
            ActionDetail, ActionEnum, MaaStatus, NodeDetail, Rect, TaskDetail,
        };
        let mut detail = TaskDetail {
            entry: "FGAA_FP".into(),
            node_id_list: vec![1],
            status: MaaStatus::SUCCEEDED,
            nodes: vec![Some(NodeDetail {
                node_name: "FGAA_FP".into(),
                reco_id: 2,
                act_id: 3,
                recognition: None,
                completed: true,
                action: Some(ActionDetail {
                    node_name: "FGAA_FP".into(),
                    action: ActionEnum::Custom,
                    box_rect: Rect::default(),
                    success: true,
                    detail: serde_json::json!({}),
                }),
            })],
        };
        assert!(completed(&detail));
        detail.nodes[0]
            .as_mut()
            .unwrap()
            .action
            .as_mut()
            .unwrap()
            .success = false;
        assert!(!completed(&detail));
        detail.nodes[0].as_mut().unwrap().action = None;
        assert!(!completed(&detail));
        detail.nodes[0] = None;
        assert!(!completed(&detail));
        detail.nodes.clear();
        assert!(!completed(&detail));
    }
    #[test]
    fn failure_preserves_finished_tasks_and_rejects_stale_ids() {
        let mut state = TaskRunState::default();
        state.overall_status = Some("Running".into());
        for (id, status) in [(1, "succeeded"), (2, "running"), (3, "pending")] {
            state.pending_task_ids.push(id);
            state.mappings.insert(id, id.to_string());
            state.statuses.insert(id.to_string(), status.into());
        }
        assert!(!abort(&mut state, 99));
        assert!(!abort(&mut state, 1));
        assert!(abort(&mut state, 2));
        assert_eq!(state.statuses["1"], "succeeded");
        assert_eq!(state.statuses["2"], "failed");
        assert_eq!(state.statuses["3"], "failed");
        assert_eq!(state.fgaa_cancelled_ids.len(), 2);
        assert!(!abort(&mut state, 2));
        assert!(!is_fgaa_entry("ordinary_task"));
        assert!(is_fgaa_entry("FGAA_FP"));
    }
}
