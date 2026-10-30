import { query } from '../db/pool.js';
import { sendError, sendJson } from '../utils/http.js';

export async function dashboardSummaryHandler(request, response) {
  if (request.method !== 'GET') return sendError(response, 405, 'Method not allowed');
  const result = await query(`
    SELECT
      (SELECT COUNT(*) FROM patients) AS totalPatients,
      (SELECT COUNT(*) FROM appointments WHERE appointment_date = CURRENT_DATE AND status = 'Scheduled') AS todayAppointments,
      (SELECT COUNT(*) FROM doctors WHERE available = TRUE) AS activeDoctors,
      (SELECT COUNT(*) FROM medicines WHERE stock <= min_stock) AS lowStockItems,
      (SELECT COUNT(*) FROM lab_orders WHERE status <> 'Completed') AS pendingReports,
      (SELECT COUNT(*) FROM medical_records WHERE visit_date >= CURRENT_DATE - INTERVAL '30 days') AS monthlyVisits
  `);
  return sendJson(response, 200, { data: result.rows[0] || {} });
}
