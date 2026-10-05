/**
 * calendarApi — Automation Calendar API helpers.
 *
 * Wraps the bizcity-automation/v1/calendar/* REST endpoints.
 *
 * @since AUTOMATION-CAL (2026-06-14)
 */
import { api } from './api.js';
import { BOOT } from './boot.js';

// Scheduler REST base — reads from BOOT.schedulerRestUrl if set, else derives from restUrl.
function schedulerBase() {
	if ( BOOT.schedulerRestUrl ) return BOOT.schedulerRestUrl.replace( /\/+$/, '' );
	// Fall-back: replace automation namespace with scheduler namespace.
	return BOOT.restUrl.replace( /bizcity-automation\/v1\/?$/, 'bizcity-scheduler/v1' );
}

export const calendarApi = {
	/**
	 * List automation events.
	 * @param {{ from?: string, to?: string, workflow_id?: number, status?: string, limit?: number }} params
	 */
	listEvents( params = {} ) {
		const qs = new URLSearchParams();
		if ( params.from )        qs.set( 'from',        params.from );
		if ( params.to )          qs.set( 'to',          params.to );
		if ( params.workflow_id ) qs.set( 'workflow_id', String( params.workflow_id ) );
		if ( params.status )      qs.set( 'status',      params.status );
		if ( params.limit )       qs.set( 'limit',       String( params.limit ) );
		const suffix = qs.toString() ? `?${qs}` : '';
		return api.get( `calendar/events${suffix}` );
	},

	/** Create one or more manual events. */
	createEvent( body ) {
		return api.post( 'calendar/events', body );
	},

	/** Update a single event. */
	updateEvent( id, body ) {
		return api.patch( `calendar/events/${id}`, body );
	},

	/** Delete a single event. */
	deleteEvent( id ) {
		return api.del( `calendar/events/${id}` );
	},

	/** Bulk delete by ids array. */
	bulkDelete( ids ) {
		return api.post( 'calendar/events/bulk-delete', { ids } );
	},

	/** Re-sync 30 upcoming events for a workflow. */
	syncWorkflow( wf_id ) {
		return api.post( `calendar/sync/${wf_id}`, {} );
	},

	/** List all workflows (used by the event create form). */
	listWorkflows() {
		return api.get( 'workflows?limit=200' );
	},
};
