import {
  completeEmergencyCase, completeOpdConsultation, createCardToOpdRequest, dispensePharmacyOrder,
  referOutside, saveOpdAssessment, sendOpdToLabRequest, sendOpdToPharmacyRequest,
  referEmergencyCase, transferToEmergency,
} from '../services/clinicWorkflows.js';
import { sendError, sendJson } from '../utils/http.js';
import { assertPlainObject, validateEnum, validateText } from '../utils/validation.js';

const queueStages = ['Reception', 'Nurse Triage', 'Doctor Consultation', 'Pharmacy', 'Laboratory', 'Emergency', 'Completed'];
const queuePriorities = ['Normal', 'Urgent', 'Emergency'];

const handlers = {
  'card-to-opd': { roles: ['admin', 'receptionist'], run: request => createCardToOpdRequest(request.body) },
  'transfer-to-emergency': { roles: ['admin', 'receptionist', 'opd'], run: request => transferToEmergency(request.body.queueItemId, request.body, request.user) },
  'opd-to-lab': { roles: ['admin', 'opd'], run: request => sendOpdToLabRequest(request.body.queueItemId, request.body) },
  'opd-to-pharmacy': { roles: ['admin', 'opd'], run: request => sendOpdToPharmacyRequest(request.body.queueItemId, request.body) },
  'complete-consultation': { roles: ['admin', 'opd'], run: request => completeOpdConsultation(request.body.queueItemId, request.body.recordData) },
  'complete-emergency': { roles: ['admin', 'emergency'], run: request => completeEmergencyCase(request.body.emergencyCaseId, request.body) },
  'refer-emergency': { roles: ['admin', 'emergency'], run: request => referEmergencyCase(request.body.emergencyCaseId, request.body, request.user) },
  'save-assessment': { roles: ['admin', 'opd'], run: request => saveOpdAssessment(request.body.queueItemId, request.body.recordData) },
  'refer-outside': { roles: ['admin', 'opd'], run: request => referOutside(request.body.queueItemId, request.body) },
  'dispense-pharmacy': { roles: ['admin', 'pharmacy'], run: request => dispensePharmacyOrder(request.body.orderId, request.body.dispensedBy, request.body.overrides, request.body.externalItems, request.body.quantities) },
};

export async function workflowHandler(request, response, segments) {
  const action = segments[2];
  if (request.method !== 'POST') return sendError(response, 405, 'Method not allowed');
  const handler = handlers[action];
  if (!handler) return sendError(response, 404, 'Workflow not found');
  if (!handler.roles.includes(request.user?.role)) return sendError(response, 403, 'This staff role cannot perform that workflow');
  assertPlainObject(request.body);
  if (action === 'card-to-opd') {
    validateText(request.body.patientId, 'Patient', { required: true, max: 80 });
    validateText(request.body.chiefComplaint, 'Reason', { required: false, max: 1000 });
    validateEnum(request.body.stage, 'Destination', queueStages, { required: true });
    validateEnum(request.body.priority, 'Priority', queuePriorities);
  }
  if (action === 'opd-to-lab') {
    validateText(request.body.queueItemId, 'Queue item', { required: true, max: 80 });
    const tests = Array.isArray(request.body.tests) ? request.body.tests : [request.body];
    if (!tests.length || tests.length > 30) return sendError(response, 422, 'Select between 1 and 30 laboratory investigations');
    for (const test of tests) {
      validateText(test.testName, 'Test name', { required: true, max: 150 });
      validateText(test.category, 'Category', { required: true, max: 80 });
      validateText(test.specimenType, 'Specimen type', { required: true, max: 100 });
      validateText(test.technologistInstructions, 'Technologist instructions', { required: false, max: 1000 });
    }
    validateText(request.body.doctorDiagnosis, 'Working diagnosis', { required: false, max: 1000 });
  }
  if (action === 'opd-to-pharmacy') {
    validateText(request.body.queueItemId, 'Queue item', { required: true, max: 80 });
    if (!Array.isArray(request.body.medicines) || request.body.medicines.length === 0 || request.body.medicines.length > 50) {
      return sendError(response, 422, 'Add at least one medicine');
    }
    validateText(request.body.doctorDiagnosis, 'Primary diagnosis', { required: false, max: 1000 });
  }
  if (action === 'complete-consultation') {
    validateText(request.body.queueItemId, 'Queue item', { required: true, max: 80 });
    assertPlainObject(request.body.recordData);
    validateText(request.body.recordData.patientId, 'Patient', { required: true, max: 80 });
    validateText(request.body.recordData.patientName, 'Patient name', { required: true, max: 150 });
    validateText(request.body.recordData.doctorName, 'Doctor name', { required: true, max: 150 });
    validateText(request.body.recordData.diagnosis, 'Diagnosis', { required: true, max: 1000 });
  }
  if (action === 'complete-emergency') {
    validateText(request.body.emergencyCaseId, 'Emergency case', { required: true, max: 80 });
  }
  if (action === 'refer-emergency') {
    validateText(request.body.emergencyCaseId, 'Emergency case', { required: true, max: 80 });
    validateText(request.body.destination, 'Referral destination', { required: true, max: 200 });
    validateText(request.body.reason, 'Referral reason', { required: true, max: 2000 });
    validateText(request.body.diagnosis, 'Diagnosis', { required: false, max: 1000 });
  }
  if (action === 'transfer-to-emergency') {
    validateText(request.body.queueItemId, 'Queue item', { required: true, max: 80 });
    validateEnum(request.body.acuity, 'Acuity', ['Red', 'Yellow', 'Green']);
    validateText(request.body.chiefComplaint, 'Chief complaint', { required: false, max: 2000 });
  }
  if (action === 'save-assessment') {
    validateText(request.body.queueItemId, 'Queue item', { required: true, max: 80 });
    assertPlainObject(request.body.recordData);
    validateText(request.body.recordData.diagnosis, 'Diagnosis', { required: false, max: 1000 });
    validateText(request.body.recordData.notes, 'Clinical notes', { required: false, max: 5000 });
  }
  if (action === 'refer-outside') {
    validateText(request.body.queueItemId, 'Queue item', { required: true, max: 80 });
    validateText(request.body.destination, 'Referral destination', { required: true, max: 200 });
    validateText(request.body.reason, 'Referral reason', { required: true, max: 2000 });
  }
  if (action === 'dispense-pharmacy') {
    validateText(request.body.orderId, 'Order', { required: true, max: 80 });
    validateText(request.body.dispensedBy, 'Dispenser', { required: true, max: 150 });
    if (request.body.quantities !== undefined && request.body.quantities !== null) {
      assertPlainObject(request.body.quantities);
      for (const [name, value] of Object.entries(request.body.quantities)) {
        validateText(name, 'Medicine name', { required: true, max: 200 });
        if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 100000) {
          return sendError(response, 422, `Dispense quantity for "${name}" must be a whole number between 1 and 100000`);
        }
      }
    }
  }
  const result = await handler.run(request);
  return sendJson(response, 200, { data: result });
}
