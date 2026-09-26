'use strict';

function hasFields(value, fields) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return (prototype === Object.prototype || prototype === null)
    && fields.every(field => Object.hasOwn(value, field));
}

function isId(value) {
  return typeof value === 'string' && value.length > 0 && value.trim() === value;
}

function isIdList(value) {
  if (!Array.isArray(value)) return false;
  for (const id of value) {
    if (!isId(id)) return false;
  }
  return true;
}

function canReadCase(principal, caseFile) {
  if (!hasFields(principal, ['id', 'role', 'active'])
      || !isId(principal.id) || principal.active !== true
      || !['admin', 'staff', 'client'].includes(principal.role)) return false;
  if (!hasFields(caseFile, ['id', 'staffIds', 'clientIds'])
      || !isId(caseFile.id) || !isIdList(caseFile.staffIds)
      || !isIdList(caseFile.clientIds)) return false;

  if (principal.role === 'admin') return true;
  const permittedIds = principal.role === 'staff' ? caseFile.staffIds : caseFile.clientIds;
  return permittedIds.includes(principal.id);
}

function canReadRecord(principal, caseFile, record) {
  if (!canReadCase(principal, caseFile)) return false;
  if (!hasFields(record, ['id', 'caseId', 'visibility', 'clientIds'])
      || !isId(record.id) || record.caseId !== caseFile.id
      || !isIdList(record.clientIds)) return false;

  if (record.visibility === 'internal') {
    return record.clientIds.length === 0 && principal.role !== 'client';
  }
  if (record.visibility !== 'client' || record.clientIds.length === 0
      || !record.clientIds.every(id => caseFile.clientIds.includes(id))) return false;

  return principal.role !== 'client' || record.clientIds.includes(principal.id);
}

module.exports = { canReadCase, canReadRecord };
