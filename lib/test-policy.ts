export function canTeacherManageTest(
  test: { subjectId: string | null; groupId: string | null },
  scope: { subjectIds: string[]; ownGroupIds: string[] },
) {
  return test.subjectId
    ? scope.subjectIds.includes(test.subjectId)
    : !!test.groupId && scope.ownGroupIds.includes(test.groupId);
}

export function hasTestOpened(opensAt: Date) {
  return opensAt.getTime() <= Date.now();
}
