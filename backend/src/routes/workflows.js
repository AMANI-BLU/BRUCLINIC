import {
  completeOpdConsultation, createCardToOpdRequest, dispensePharmacyOrder,
  sendOpdToLabRequest, sendOpdToPharmacyRequest,
} from '../services/clinicWorkflows.js';
import { sendError, sendJson } from '../utils/http.js';
import { assertPlainObject, validateEnum, validateText } from '../utils/validation.js';

const queueStages = ['Reception', 'Nurse Triage', 'Doctor Consultation', 'Pharmacy', 'Laboratory', 'Emergency', 'Completed'];
const queuePriorities = ['Normal', 'Urgent', 'Emergency'];

const handlers = {
  'card-to-opd': { roles: ['admin', 'receptionist'], run: request => createCardToOpdRequest(request.body) },
  'opd-to-lab': { roles: ['admin', 'opd'], run: request => sendOpdToLabRequest(request.body.queueItemId, request.body) },
  'opd-to-pharmacy': { roles: ['admin', 'opd'], run: request => sendOpdToPharmacyRequest(request.body.queueItemId, request.body) },
  'complete-consultation': { roles: ['admin', 'opd'], run: request => completeOpdConsultation(request.body.queueItemId, request.body) },
  'dispense-pharmacy': { roles: ['admin', 'pharmacy'], run: request => dispensePharmacyOrder(request.body.orderId, request.body.dispensedBy) },
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
    validateText(request.body.chiefComplaint, 'Reason', { required: true, max: 1000 });
    validateEnum(request.body.stage, 'Destination', queueStages, { required: true });
    validateEnum(request.body.priority, 'Priority', queuePriorities);
  }
  if (action === 'opd-to-lab') {
    validateText(request.body.queueItemId, 'Queue item', { required: true, max: 80 });
    validateText(request.body.testName, 'Test name', { required: true, max: 150 });
    validateText(request.body.category, 'Category', { required: true, max: 120 });
    validateText(request.body.specimenType, 'Specimen type', { required: true, max: 100 });
  }
  if (action === 'opd-to-pharmacy') {
    validateText(request.body.queueItemId, 'Queue item', { required: true, max: 80 });
    if (!Array.isArray(request.body.medicines) || request.body.medicines.length === 0 || request.body.medicines.length > 50) {
      return sendError(response, 422, 'Add at least one medicine');
    }
  }
  if (action === 'complete-consultation') {
    validateText(request.body.queueItemId, 'Queue item', { required: true, max: 80 });
    assertPlainObject(request.body.recordData);
    validateText(request.body.recordData.patientId, 'Patient', { required: true, max: 80 });
    validateText(request.body.recordData.patientName, 'Patient name', { required: true, max: 150 });
    validateText(request.body.recordData.doctorName, 'Doctor name', { required: true, max: 150 });
    validateText(request.body.recordData.diagnosis, 'Diagnosis', { required: true, max: 1000 });
  }
  if (action === 'dispense-pharmacy') {
    validateText(request.body.orderId, 'Order', { required: true, max: 80 });
    validateText(request.body.dispensedBy, 'Dispenser', { required: true, max: 150 });
  }
  const result = await handler.run(request);
  return sendJson(response, 200, { data: result });
}
