// ==========================================
// ENUM STRING UNIONS (replacing Prisma enums)
// ==========================================

export type UserRole = 'ADMIN' | 'STUDENT';
export const UserRole = { ADMIN: 'ADMIN' as UserRole, STUDENT: 'STUDENT' as UserRole };

export type EventStatus = 'DRAFT' | 'READY' | 'LIVE' | 'PAUSED' | 'ENDED';

export type RoundType = 'MCQ' | 'OUTPUT_PREDICTION' | 'DEBUGGING' | 'PROGRAMMING';
export const RoundType = { MCQ: 'MCQ' as RoundType, OUTPUT_PREDICTION: 'OUTPUT_PREDICTION' as RoundType, DEBUGGING: 'DEBUGGING' as RoundType, PROGRAMMING: 'PROGRAMMING' as RoundType };

export type RoundStatus = 'DRAFT' | 'READY' | 'LIVE' | 'PAUSED' | 'ENDED';
export const RoundStatus = { DRAFT: 'DRAFT' as RoundStatus, READY: 'READY' as RoundStatus, LIVE: 'LIVE' as RoundStatus, PAUSED: 'PAUSED' as RoundStatus, ENDED: 'ENDED' as RoundStatus };

export type QuestionType = 'MCQ' | 'MULTIPLE_CHOICE' | 'OUTPUT_PREDICTION';
export const QuestionType = { MCQ: 'MCQ' as QuestionType, MULTIPLE_CHOICE: 'MULTIPLE_CHOICE' as QuestionType, OUTPUT_PREDICTION: 'OUTPUT_PREDICTION' as QuestionType };

export type ComparisonMethod = 'EXACT' | 'EXACT_IGNORE_CASE' | 'TRIM' | 'REGEX';
export const ComparisonMethod = { EXACT: 'EXACT' as ComparisonMethod, EXACT_IGNORE_CASE: 'EXACT_IGNORE_CASE' as ComparisonMethod, TRIM: 'TRIM' as ComparisonMethod, REGEX: 'REGEX' as ComparisonMethod };

export type TestCaseVisibility = 'VISIBLE' | 'HIDDEN';
export const TestCaseVisibility = { VISIBLE: 'VISIBLE' as TestCaseVisibility, HIDDEN: 'HIDDEN' as TestCaseVisibility };

export type ProgrammingLanguage = 'C' | 'JAVA' | 'CPP' | 'PYTHON';
export const ProgrammingLanguage = { C: 'C' as ProgrammingLanguage, JAVA: 'JAVA' as ProgrammingLanguage, CPP: 'CPP' as ProgrammingLanguage, PYTHON: 'PYTHON' as ProgrammingLanguage };

export type RoundProgressStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'PAUSED' | 'SUBMITTED' | 'LOCKED';
export const RoundProgressStatus = { NOT_STARTED: 'NOT_STARTED' as RoundProgressStatus, IN_PROGRESS: 'IN_PROGRESS' as RoundProgressStatus, PAUSED: 'PAUSED' as RoundProgressStatus, SUBMITTED: 'SUBMITTED' as RoundProgressStatus, LOCKED: 'LOCKED' as RoundProgressStatus };

export type ViolationType = 'FULLSCREEN_EXIT' | 'TAB_SWITCH' | 'WINDOW_BLUR' | 'OTHER';
export const ViolationType = { FULLSCREEN_EXIT: 'FULLSCREEN_EXIT' as ViolationType, TAB_SWITCH: 'TAB_SWITCH' as ViolationType, WINDOW_BLUR: 'WINDOW_BLUR' as ViolationType, OTHER: 'OTHER' as ViolationType };

// ==========================================
// DATABASE ROW INTERFACES
// ==========================================

export interface DbUser {
  id: string;
  email: string | null;
  username: string;
  passwordHash: string;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface DbStudent {
  id: string;
  userId: string;
  studentId: string;
  fullName: string;
  batchNumber: string;
  batchId: string | null;
  batch?: DbBatch | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DbAdmin {
  id: string;
  userId: string;
  name: string;
  metadata: any;
  createdAt: Date;
  updatedAt: Date;
}

export interface DbBatch {
  id: string;
  batchNumber: string;
  name: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DbSession {
  id: string;
  userId: string;
  sessionToken: string;
  createdAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
  lastSeenAt: Date;
}

export interface DbAuditLog {
  id: string;
  userId: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  metadata: any;
  createdAt: Date;
}

export interface DbEvent {
  id: string;
  name: string;
  description: string | null;
  status: EventStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface DbEventSettings {
  id: string;
  eventId: string;
  maximumViolations: number;
  continuationPasswordHash: string | null;
  singleSession: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface DbVisibilitySettings {
  id: string;
  eventId: string;
  showAnswers: boolean;
  showResults: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface DbRound {
  id: string;
  eventId: string;
  name: string;
  type: RoundType;
  description: string | null;
  order: number;
  duration: number;
  maximumMarks: number;
  status: RoundStatus;
  isEnabled: boolean;
  startTime: Date | null;
  endTime: Date | null;
  remainingSeconds: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DbQuestion {
  id: string;
  roundId: string;
  questionText: string;
  questionType: QuestionType;
  marks: number;
  negativeMarks: number;
  order: number;
  isActive: boolean;
  correctAnswer: string | null;
  code: string | null;
  correctOutput: string | null;
  comparisonMethod: ComparisonMethod;
  createdAt: Date;
  updatedAt: Date;
}

export interface DbQuestionOption {
  id: string;
  questionId: string;
  optionKey: string;
  optionText: string;
  order: number;
}

export interface DbStudentAnswer {
  id: string;
  studentId: string;
  questionId: string;
  answer: string;
  submittedAt: Date;
  updatedAt: Date;
}

export interface DbDebuggingProblem {
  id: string;
  roundId: string;
  title: string;
  description: string;
  buggyCode: string;
  solutionCode: string | null;
  starterCode: string | null;
  maximumMarks: number;
  timeLimit: number;
  memoryLimit: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface DbBugDefinition {
  id: string;
  debuggingProblemId: string;
  bugId: string;
  title: string;
  description: string | null;
  marks: number;
  validationConfig: any;
  order: number;
  isActive: boolean;
}

export interface DbBugAward {
  id: string;
  studentId: string;
  bugDefinitionId: string;
  debuggingSubmissionId: string | null;
  marksAwarded: number;
  awardedAt: Date;
}

export interface DbDebuggingSubmission {
  id: string;
  studentId: string;
  debuggingProblemId: string;
  submittedCode: string;
  submissionNumber: number;
  compileStatus: string | null;
  compileOutput: string | null;
  executionOutput: string | null;
  executionTime: number | null;
  memoryUsed: number | null;
  score: number;
  submittedAt: Date;
}

export interface DbProgrammingProblem {
  id: string;
  roundId: string;
  title: string;
  description: string;
  inputFormat: string | null;
  outputFormat: string | null;
  constraints: string | null;
  examples: any;
  starterCode: string | null;
  supportedLanguages: string[];
  maximumMarks: number;
  timeLimit: number;
  memoryLimit: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface DbTestCase {
  id: string;
  programmingProblemId: string;
  input: string;
  expectedOutput: string;
  marks: number;
  visibility: TestCaseVisibility;
  order: number;
  isActive: boolean;
}

export interface DbProgrammingSubmission {
  id: string;
  studentId: string;
  programmingProblemId: string;
  language: ProgrammingLanguage;
  submittedCode: string;
  submissionNumber: number;
  compileStatus: string | null;
  compileOutput: string | null;
  executionOutput: string | null;
  passedTests: number;
  totalTests: number;
  score: number;
  executionTime: number | null;
  memoryUsed: number | null;
  compileAttempts: number;
  runAttempts: number;
  submissionStatus: string;
  submittedAt: Date;
}

export interface DbRoundProgress {
  id: string;
  studentId: string;
  roundId: string;
  status: RoundProgressStatus;
  startedAt: Date | null;
  lastSavedAt: Date | null;
  submittedAt: Date | null;
  lockedAt: Date | null;
  stateData: any;
}

export interface DbRoundScore {
  id: string;
  studentId: string;
  roundId: string;
  score: number;
  maximumScore: number;
  submittedAt: Date;
  calculatedAt: Date;
}

export interface DbFinalScore {
  id: string;
  studentId: string;
  round1Score: number;
  round2Score: number;
  round3Score: number;
  totalScore: number;
  rank: number | null;
  status: string;
  calculatedAt: Date;
  updatedAt: Date;
}

export interface DbViolation {
  id: string;
  studentId: string;
  roundId: string;
  type: ViolationType;
  details: string | null;
  timestamp: Date;
}

// Column name mapping helpers (camelCase → snake_case for database columns)
// Prisma schema uses camelCase field names but the actual DB columns use camelCase too
// because Prisma creates columns matching the field names unless @map is used on individual fields.
// The @@map directive maps the MODEL name to the TABLE name, but column names stay camelCase.
// So we query with camelCase column names wrapped in quotes.
