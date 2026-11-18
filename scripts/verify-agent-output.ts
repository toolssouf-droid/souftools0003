import assert from "node:assert/strict";
import {
  createSafeAnswerTokenSink,
  isAgentDecisionPayload,
  parseAgentDecisionResponse,
} from "../lib/agent/agentDecisionParser";
import { compileAgentActivityState } from "../lib/agent/agentEvents";

const validDecision = parseAgentDecisionResponse(
  'prefix ```json\n{"updatedPlan":["بحث"],"action":{"type":"CALL_TOOLS","tool":"web_search"}}\n```'
);
assert.equal(validDecision?.action.type, "CALL_TOOLS");
assert.equal(parseAgentDecisionResponse('{"thoughtSummary":"تحليل","action":'), null);
assert.equal(parseAgentDecisionResponse('{"action":{"type":"UNKNOWN"}}'), null);

assert.equal(
  isAgentDecisionPayload('{"thoughtSummary":"خطة داخلية","action":{"type":"CALL_TOOLS","toolsToCall":[]}}'),
  true
);
assert.equal(isAgentDecisionPayload('{"title":"Princess Mononoke","platforms":["Apple TV"]}'), false);

const activityState = compileAgentActivityState({
  taskId: "test",
  status: "completed",
  userRequest: "test",
  goal: "test",
  plan: [],
  currentStep: "",
  completedSteps: [],
  observations: [],
  toolCalls: [],
  toolResults: {},
  errors: [],
  iteration: 1,
  maxSteps: 1,
  startedAt: 0,
  completedAt: 1,
  agentSteps: [],
  activities: [
    {
      id: "internal",
      type: "thinking_summary",
      title: "🧠 تحليل واستدلال أولي",
      description: "private reasoning",
      status: "completed",
      timestamp: 0,
    },
    {
      id: "public",
      type: "tool_completed",
      title: "تم إنجاز أداة البحث",
      status: "completed",
      timestamp: 1,
    },
  ],
  toolBudget: {},
  budgetUsed: {},
});
assert.deepEqual(activityState.activities.map((activity) => activity.id), ["public"]);

const leakedTokens: string[] = [];
const protectedSink = createSafeAnswerTokenSink((token) => leakedTokens.push(token));
protectedSink('{"thoughtSummary":');
protectedSink('"خطة داخلية"}');
assert.deepEqual(leakedTokens, []);

const streamedTokens: string[] = [];
const answerSink = createSafeAnswerTokenSink((token) => streamedTokens.push(token));
answerSink("هذه إجابة");
answerSink(" نهائية.");
assert.equal(streamedTokens.join(""), "هذه إجابة نهائية.");

console.log("Agent output checks passed.");
