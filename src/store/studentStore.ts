import { create } from "zustand";

interface Subject {
  id: string;
  name: string;
  code: string;
}

interface Assignment {
  id: string;
  subject: { id: string; name: string; code: string };
  fileName: string;
  fileUrl: string;
  fileSize: number;
  status: string;
  grade: number | null;
  feedback: string | null;
  createdAt: string;
  evaluatedAt: string | null;
}

interface Grade {
  id: string;
  subjectName: string;
  grade: number;
  feedback: string | null;
  evaluatorName: string | null;
  evaluatedAt: string;
}

interface Stats {
  total: number;
  evaluated: number;
  subjects: number;
}

interface StudentState {
  userLevel: string;
  activeTab: number;
  subjects: Subject[];
  selectedSubject: string;
  selectedFile: File | null;
  uploading: boolean;
  uploadMessage: string;
  assignments: Assignment[];
  assignmentsLoading: boolean;
  assignmentsPage: number;
  assignmentsTotalPages: number;
  grades: Grade[];
  gradesLoading: boolean;
  gradesPage: number;
  gradesTotalPages: number;
  stats: Stats;

  setUserLevel: (level: string) => void;
  setActiveTab: (tab: number) => void;
  setSubjects: (subjects: Subject[]) => void;
  setSelectedSubject: (id: string) => void;
  setSelectedFile: (file: File | null) => void;
  setUploading: (v: boolean) => void;
  setUploadMessage: (msg: string) => void;
  setAssignments: (a: Assignment[]) => void;
  setAssignmentsLoading: (v: boolean) => void;
  setAssignmentsPage: (p: number | ((prev: number) => number)) => void;
  setAssignmentsTotalPages: (p: number) => void;
  setGrades: (g: Grade[]) => void;
  setGradesLoading: (v: boolean) => void;
  setGradesPage: (p: number | ((prev: number) => number)) => void;
  setGradesTotalPages: (p: number) => void;
  setStats: (s: Stats) => void;
}

export const useStudentStore = create<StudentState>((set) => ({
  userLevel: "LEVEL_1",
  activeTab: 0,
  subjects: [],
  selectedSubject: "",
  selectedFile: null,
  uploading: false,
  uploadMessage: "",
  assignments: [],
  assignmentsLoading: true,
  assignmentsPage: 1,
  assignmentsTotalPages: 1,
  grades: [],
  gradesLoading: true,
  gradesPage: 1,
  gradesTotalPages: 1,
  stats: { total: 0, evaluated: 0, subjects: 0 },

  setUserLevel: (level) => set({ userLevel: level }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  setSubjects: (subjects) => set({ subjects }),
  setSelectedSubject: (id) => set({ selectedSubject: id }),
  setSelectedFile: (file) => set({ selectedFile: file }),
  setUploading: (v) => set({ uploading: v }),
  setUploadMessage: (msg) => set({ uploadMessage: msg }),
  setAssignments: (a) => set({ assignments: a }),
  setAssignmentsLoading: (v) => set({ assignmentsLoading: v }),
  setAssignmentsPage: (p) => set((state) => ({ assignmentsPage: typeof p === "function" ? p(state.assignmentsPage) : p })),
  setAssignmentsTotalPages: (p) => set({ assignmentsTotalPages: p }),
  setGrades: (g) => set({ grades: g }),
  setGradesLoading: (v) => set({ gradesLoading: v }),
  setGradesPage: (p) => set((state) => ({ gradesPage: typeof p === "function" ? p(state.gradesPage) : p })),
  setGradesTotalPages: (p) => set({ gradesTotalPages: p }),
  setStats: (s) => set({ stats: s }),
}));
