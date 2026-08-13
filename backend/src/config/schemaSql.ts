/**
 * SQL fragments and type mappers aligning application code with the live PostgreSQL schema.
 * The database uses Prisma migration columns (orderNo, state, tokenJti, etc.)
 * while the API exposes familiar names (order, status, sessionToken, etc.).
 */

/** Map frontend/API round type to DB enum value */
export function apiRoundTypeToDb(type: string): string {
  switch (type) {
    case 'MCQ':
    case 'OUTPUT_PREDICTION':
      return 'ROUND1';
    case 'DEBUGGING':
      return 'ROUND2';
    case 'PROGRAMMING':
      return 'ROUND3';
    default:
      return type;
  }
}

/** Map DB round type to frontend/API value */
export function dbRoundTypeToApi(type: string): string {
  switch (type) {
    case 'ROUND1':
      return 'MCQ';
    case 'ROUND2':
      return 'DEBUGGING';
    case 'ROUND3':
      return 'PROGRAMMING';
    default:
      return type;
  }
}

/** Map API question type to DB enum value */
export function apiQuestionTypeToDb(type: string): string {
  if (type === 'OUTPUT_PREDICTION') return 'OUTPUT';
  return type;
}

/** Map DB question type to API value */
export function dbQuestionTypeToApi(type: string): string {
  if (type === 'OUTPUT') return 'OUTPUT_PREDICTION';
  return type;
}

/** Map API violation type to DB enum (TAB_SWITCH -> TAB_HIDDEN) */
export function apiViolationTypeToDb(type: string): string {
  if (type === 'TAB_SWITCH') return 'TAB_HIDDEN';
  if (type === 'OTHER') return 'WINDOW_BLUR';
  return type;
}

/** Map DB violation type to API value */
export function dbViolationTypeToApi(type: string): string {
  if (type === 'TAB_HIDDEN') return 'TAB_SWITCH';
  if (type === 'MULTIPLE_SESSION') return 'OTHER';
  return type;
}

export const SQL = {
  /** Standard round SELECT with API-friendly column aliases */
  ROUND_SELECT: `
    SELECT id, "eventId", name,
      CASE type::text
        WHEN 'ROUND1' THEN 'MCQ'
        WHEN 'ROUND2' THEN 'DEBUGGING'
        WHEN 'ROUND3' THEN 'PROGRAMMING'
        ELSE type::text
      END AS type,
      "orderNo" AS "order",
      state AS status,
      "durationMinutes" AS duration,
      "maxMarks" AS "maximumMarks",
      true AS "isEnabled",
      "startTime", "endTime",
      "pausedAt", "totalPausedSeconds",
      "createdAt", "updatedAt"
    FROM rounds`,

  /** Event with API-friendly aliases */
  EVENT_SELECT: `
    SELECT id, title AS name, status, "isMock", "createdAt", "updatedAt"
    FROM events`,

  /** Event settings with API-friendly aliases */
  EVENT_SETTINGS_SELECT: `
    SELECT id, "eventId",
      "fullscreenViolationLimit" AS "maximumViolations",
      "continuationPassword" AS "continuationPasswordHash",
      CASE WHEN "sessionPolicy" = 'REJECT_NEW' THEN true ELSE false END AS "singleSession",
      "autosaveDebounceMs",
      "createdAt", "updatedAt"
    FROM event_settings`,

  /** Student joined with user studentId and batch code */
  STUDENT_SELECT: `
    SELECT s.id, s."userId", u."studentId", s."fullName",
           b.code AS "batchNumber", s."batchId", s.status,
           s."createdAt", s."updatedAt"
    FROM students s
    JOIN users u ON u.id = s."userId"
    LEFT JOIN batches b ON b.id = s."batchId"`,

  /** Session with API-friendly aliases */
  SESSION_SELECT: `
    SELECT id, "userId",
      "tokenJti" AS "sessionToken",
      "createdAt", "expiresAt", "revokedAt", "isRevoked",
      "updatedAt" AS "lastSeenAt"
    FROM sessions`,

  /** Question with API-friendly aliases */
  QUESTION_SELECT: `
    SELECT id, "roundId",
      prompt AS "questionText",
      CASE type::text WHEN 'OUTPUT' THEN 'OUTPUT_PREDICTION' ELSE type::text END AS "questionType",
      marks, "negativeMarks",
      "orderNo" AS "order",
      "isEnabled" AS "isActive",
      "correctOptionKey" AS "correctAnswer",
      "codeSnippet" AS code,
      "expectedOutput" AS "correctOutput",
      "comparisonMethod"::text AS "comparisonMethod",
      "createdAt", "updatedAt"
    FROM questions`,

  /** Question option with API-friendly aliases */
  QUESTION_OPTION_SELECT: `
    SELECT id, "questionId", "optionKey", "optionText",
           "orderNo" AS "order"
    FROM question_options`,

  /** Student answer with API-friendly aliases */
  STUDENT_ANSWER_SELECT: `
    SELECT id, "studentId", "roundId", "questionId",
      COALESCE("selectedOptionKey", "answerText") AS answer,
      "selectedOptionKey", "answerText",
      "isFinal", "awardedMarks",
      "createdAt" AS "submittedAt", "updatedAt"
    FROM student_answers`,

  /** Round progress with API-friendly aliases */
  ROUND_PROGRESS_SELECT: `
    SELECT id, "studentId", "roundId", status,
      "createdAt" AS "startedAt", "updatedAt" AS "lastSavedAt",
      "submittedAt", "lockedAt",
      "savedData" AS "stateData"
    FROM round_progress`,

  /** Round score with API-friendly aliases */
  ROUND_SCORE_SELECT: `
    SELECT id, "studentId", "roundId", score,
      "maxMarks" AS "maximumScore",
      "evaluatedAt" AS "submittedAt", "evaluatedAt" AS "calculatedAt",
      "createdAt", "updatedAt"
    FROM round_scores`,

  /** Final score with API-friendly aliases */
  FINAL_SCORE_SELECT: `
    SELECT id, "studentId", "totalScore", "maxScore" AS "maximumScore",
      rank, "updatedAt", "createdAt"
    FROM final_scores`,

  /** Violation with API-friendly aliases */
  VIOLATION_SELECT: `
    SELECT id, "studentId", "roundId",
      CASE type::text
        WHEN 'TAB_HIDDEN' THEN 'TAB_SWITCH'
        WHEN 'MULTIPLE_SESSION' THEN 'OTHER'
        ELSE type::text
      END AS type,
      count, details,
      "createdAt" AS timestamp
    FROM violations`,

  /** Debugging problem with API-friendly aliases */
  DEBUGGING_PROBLEM_SELECT: `
    SELECT id, "roundId", title, description, "buggyCode",
      NULL AS "solutionCode", NULL AS "starterCode",
      marks AS "maximumMarks", 2 AS "timeLimit", 128 AS "memoryLimit",
      "isEnabled" AS "isActive", "orderNo",
      "createdAt", "updatedAt"
    FROM debugging_problems`,

  /** Bug definition with API-friendly aliases */
  BUG_DEFINITION_SELECT: `
    SELECT id, "problemId" AS "debuggingProblemId",
      "bugCode" AS "bugId", title, description, marks,
      NULL AS "validationConfig", 1 AS "order", true AS "isActive",
      "createdAt", "updatedAt"
    FROM bug_definitions`,

  /** Debugging submission with API-friendly aliases */
  DEBUGGING_SUBMISSION_SELECT: `
    SELECT id, "studentId", "problemId" AS "debuggingProblemId",
      "sourceCode" AS "submittedCode", 1 AS "submissionNumber",
      NULL AS "compileStatus", NULL AS "compileOutput", NULL AS "executionOutput",
      NULL AS "executionTime", NULL AS "memoryUsed", 0 AS score,
      "submittedAt", "isFinal", "createdAt", "updatedAt"
    FROM debugging_submissions`,

  /** Programming problem with API-friendly aliases */
  PROGRAMMING_PROBLEM_SELECT: `
    SELECT id, "roundId", title, description,
      "inputFormat", "outputFormat", constraints, examples,
      "starterCode", ARRAY['C','JAVA','CPP','PYTHON']::text[] AS "supportedLanguages",
      marks AS "maximumMarks", "timeLimitSec" AS "timeLimit",
      "memoryLimitMb" AS "memoryLimit",
      "isEnabled" AS "isActive", "orderNo",
      "createdAt", "updatedAt"
    FROM programming_problems`,

  /** Test case with API-friendly aliases */
  TEST_CASE_SELECT: `
    SELECT id, "problemId" AS "programmingProblemId",
      input, "expectedOutput", marks,
      CASE WHEN "isHidden" THEN 'HIDDEN' ELSE 'VISIBLE' END AS visibility,
      "orderNo" AS "order", true AS "isActive",
      "createdAt", "updatedAt"
    FROM test_cases`,

  /** Programming submission with API-friendly aliases */
  PROGRAMMING_SUBMISSION_SELECT: `
    SELECT id, "studentId", "problemId" AS "programmingProblemId",
      language, "sourceCode" AS "submittedCode", 1 AS "submissionNumber",
      NULL AS "compileStatus", NULL AS "compileOutput", NULL AS "executionOutput",
      0 AS "passedTests", 0 AS "totalTests", score,
      NULL AS "executionTime", NULL AS "memoryUsed",
      0 AS "compileAttempts", 0 AS "runAttempts",
      status::text AS "submissionStatus",
      "submittedAt", "isFinal", "resultJson",
      "createdAt", "updatedAt"
    FROM programming_submissions`,

  /** Admin with API-friendly aliases */
  ADMIN_SELECT: `
    SELECT id, "userId", "displayName" AS name,
      NULL::jsonb AS metadata, "createdAt", "updatedAt"
    FROM admins`,

  /** Batch with API-friendly aliases */
  BATCH_SELECT: `
    SELECT id, code AS "batchNumber", name,
           NULL AS description, "createdAt", "updatedAt"
    FROM batches`,

  /** Audit log INSERT using actual DB columns */
  AUDIT_INSERT: `
    INSERT INTO audit_logs (id, action, "entityType", "entityId", "actorUserId", metadata, "createdAt")
    VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, NOW())`,
} as const;
