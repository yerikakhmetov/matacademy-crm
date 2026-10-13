-- Индексы под частые выборки: % посещаемости ученика, отметки за месяц, фильтры журнала аудита.
CREATE INDEX "Attendance_studentId_idx" ON "Attendance"("studentId");
CREATE INDEX "Attendance_date_idx" ON "Attendance"("date");
CREATE INDEX "AuditLog_entity_idx" ON "AuditLog"("entity");
CREATE INDEX "AuditLog_userName_idx" ON "AuditLog"("userName");
