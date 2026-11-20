import { Router } from 'express';
import {
  completeEmergencyCase, completeOpdConsultation, createCardToOpdRequest, dispensePharmacyOrder,
  completeLabRequest, referOutside, saveOpdAssessment, sendEmergencyToLabRequest, sendOpdToLabRequest, sendOpdToPharmacyRequest,
  referEmergencyCase, transferToEmergency,
} from '../services/clinicWorkflows.js';
import { sendError, sendJson } from '../utils/http.js';
import { assertPlainObject, validateEnum, validateText } from '../utils/validation.js';

const router = Router();

const queueStages = ['Reception', 'Nurse Triage', 'Doctor Consultation', 'Pharmacy', 'Laboratory', 'Emergency', 'Completed'];
const queuePriorities = ['Normal', 'Urgent', 'Emergency'];

const handlers = {
  'card-to-opd': { roles: ['admin', 'receptionist'], run: request => createCardToOpdRequest(request.body) },
  'transfer-to-emergency': { roles: ['admin', 'receptionist', 'opd'], run: request => transferToEmergency(request.body.queueItemId, request.body, request.user) },
  'opd-to-lab': { roles: ['admin', 'opd'], run: request => sendOpdToLabRequest(request.body.queueItemId, request.body) },
  'emergency-to-lab': { roles: ['admin', 'emergency'], run: request => sendEmergencyToLabRequest(request.body.emergencyCaseId, request.body) },
  'lab-to-opd': { roles: ['admin', 'laboratory'], run: request => completeLabRequest(request.body.queueItemId, request.body.results) },
  'opd-to-pharmacy': { roles: ['admin', 'opd'], run: request => sendOpdToPharmacyRequest(request.body.queueItemId, request.body) },
  'complete-consultation': { roles: ['admin', 'opd'], run: request => completeOpdConsultation(request.body.queueItemId, { ...request.body.recordData, doctorId: request.user?.role === 'opd' ? request.user.id : request.body.recordData.doctorId }) },
  'complete-emergency': { roles: ['admin', 'emergency'], run: request => completeEmergencyCase(request.body.emergencyCaseId, request.body) },
  'refer-emergency': { roles: ['admin', 'emergency'], run: request => referEmergencyCase(request.body.emergencyCaseId, request.body, request.user) },
  'save-assessment': { roles: ['admin', 'opd'], run: request => saveOpdAssessment(request.body.queueItemId, request.body.recordData) },
  'refer-outside': { roles: ['admin', 'opd'], run: request => referOutside(request.body.queueItemId, request.body) },
  'dispense-pharmacy': { roles: ['admin', 'pharmacy'], run: request => dispensePharmacyOrder(request.body.orderId, request.body.dispensedBy, request.body.overrides, request.body.externalItems, request.body.quantities) },
};

async function executeWorkflow(action, request, response) {
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
    if (!tests.length || tests.length > 100) return sendError(response, 422, 'Select between 1 and 100 laboratory investigations');
    for (const test of tests) {
      validateText(test.testName, 'Test name', { required: true, max: 150 });
      validateText(test.category, 'Category', { required: true, max: 80 });
      validateText(test.specimenType, 'Specimen type', { required: true, max: 100 });
      validateText(test.unit, 'Unit', { required: false, max: 40 });
      validateText(test.referenceRange, 'Reference range', { required: false, max: 100 });
      validateText(test.technologistInstructions, 'Technologist instructions', { required: false, max: 1000 });
      if (test.star !== undefined && typeof test.star !== 'boolean') return sendError(response, 422, 'STAR status must be true or false');
    }
    validateText(request.body.doctorDiagnosis, 'Working diagnosis', { required: false, max: 1000 });
  }
  if (action === 'emergency-to-lab') {
    validateText(request.body.emergencyCaseId, 'Emergency case', { required: true, max: 80 });
    validateEnum(request.body.priority, 'Priority', ['Low', 'Medium', 'High', 'Critical'], { required: true });
    if (!Array.isArray(request.body.tests) || request.body.tests.length === 0 || request.body.tests.length > 100) {
      return sendError(response, 422, 'Select between 1 and 100 laboratory investigations');
    }
    for (const test of request.body.tests) {
      assertPlainObject(test);
      validateText(test.testName, 'Test name', { required: true, max: 150 });
      validateText(test.category, 'Category', { required: true, max: 80 });
      validateText(test.specimenType, 'Specimen type', { required: true, max: 100 });
      validateText(test.unit, 'Unit', { required: false, max: 40 });
      validateText(test.referenceRange, 'Reference range', { required: false, max: 100 });
      validateText(test.technologistInstructions, 'Technologist instructions', { required: false, max: 1000 });
      if (test.star !== undefined && typeof test.star !== 'boolean') return sendError(response, 422, 'STAR status must be true or false');
    }
    validateText(request.body.doctorName, 'Requesting clinician', { required: false, max: 150 });
    validateText(request.body.doctorDiagnosis, 'Working diagnosis', { required: false, max: 1000 });
    validateText(request.body.notes, 'Clinical notes', { required: false, max: 5000 });
  }
  if (action === 'lab-to-opd') {
    validateText(request.body.queueItemId, 'Queue item', { required: true, max: 80 });
    if (!Array.isArray(request.body.results) || request.body.results.length === 0 || request.body.results.length > 100) {
      return sendError(response, 422, 'Submit between 1 and 100 laboratory results');
    }
    const seenResultIds = new Set();
    for (const result of request.body.results) {
      assertPlainObject(result);
      validateText(result.id, 'Laboratory order', { required: true, max: 80 });
      validateText(result.result, 'Result', { required: true, max: 5000 });
      validateText(result.unit, 'Unit', { required: false, max: 40 });
      validateText(result.referenceRange, 'Reference range', { required: false, max: 2000 });
      validateText(result.technicianInitials, 'Technologist initials', { required: false, max: 40 });
      validateText(result.technicianComment, 'Technologist comment', { required: false, max: 2000 });
      validateText(result.approvedBy, 'Approver', { required: false, max: 180 });
      if (seenResultIds.has(result.id)) return sendError(response, 422, 'Each laboratory test can only be submitted once');
      seenResultIds.add(result.id);
      if (result.isAbnormal !== undefined && typeof result.isAbnormal !== 'boolean') return sendError(response, 422, 'Abnormal status must be true or false');
      if (result.star !== undefined && typeof result.star !== 'boolean') return sendError(response, 422, 'STAR status must be true or false');
      if (result.cost !== undefined && result.cost !== null && (typeof result.cost !== 'number' || !Number.isFinite(result.cost) || result.cost < 0)) {
        return sendError(response, 422, 'Cost must be a non-negative number');
      }
    }
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
    if (request.body.referralDetails !== undefined) {
      assertPlainObject(request.body.referralDetails);
      validateText(request.body.referralDetails.occupation, 'Occupation', { required: false, max: 150 });
      validateText(request.body.referralDetails.patientHistory, 'Patient history', { required: false, max: 3000 });
      validateText(request.body.referralDetails.physicalExamination, 'Physical examination', { required: false, max: 3000 });
      validateText(request.body.referralDetails.actionTaken, 'Action taken', { required: false, max: 2000 });
      validateText(request.body.referralDetails.referralNumber, 'Referral number', { required: false, max: 80 });
    }
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

// Express Router: POST /api/workflows/:action
router.post('/:action', async (req, res, next) => {
  try {
    await executeWorkflow(req.params.action, req, res);
  } catch (err) {
    next(err);
  }
});

// Legacy handler export for backward compatibility
export async function workflowHandler(request, response, segments) {
  const action = segments[2];
  if (request.method !== 'POST') return sendError(response, 405, 'Method not allowed');
  return executeWorkflow(action, request, response);
}

export default router;
export { router as workflowsRouter };
