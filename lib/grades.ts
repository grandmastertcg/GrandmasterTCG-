export const GRADERS = ["PSA", "BGS", "CGC", "ACE", "SGC", "TAG", "Other"] as const;
export const GRADES = ["10", "9.5", "9", "8.5", "8", "7.5", "7", "6.5", "6", "5.5", "5", "4", "3", "2", "1"] as const;

export function gradeLabel(grader: string, grade: string) {
  return `${grader} ${grade}`;
}
