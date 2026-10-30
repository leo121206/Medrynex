/**
 * records.service.ts — Real API integration only.
 * No mock fallbacks. Throws on API failure so callers can show error states.
 */
import { MedicalRecord, UploadRecordPayload, UploadVersionPayload, RecordVersionItem } from '../types/record';
import { apiRequest, API_BASE, getAuthToken } from './apiClient';

export const recordsService = {
  async getRecords(patientId?: string): Promise<MedicalRecord[]> {
    const endpoint = patientId
      ? `/records?patientId=${encodeURIComponent(patientId)}`
      : '/records';
    return apiRequest<MedicalRecord[]>(endpoint);
  },

  async getRecordById(id: string): Promise<MedicalRecord> {
    return apiRequest<MedicalRecord>(`/records/${id}`);
  },

  async downloadRecord(
    id: string,
    fallbackFilename?: string,
    triggerBrowserDownload: boolean = true
  ): Promise<{ blob: Blob; filename: string; textPreview: string }> {
    const token = getAuthToken();
    const headers = new Headers();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    const response = await fetch(`${API_BASE}/records/${encodeURIComponent(id)}/download`, {
      method: 'GET',
      credentials: 'include',
      headers,
    });

    if (!response.ok) {
      let errMsg = `HTTP ${response.status}`;
      try {
        const errJson = await response.json();
        errMsg = errJson?.error?.message || errJson?.message || errMsg;
      } catch {
        // non-json error response
      }
      throw new Error(errMsg);
    }

    const disposition = response.headers.get('Content-Disposition') || '';
    const match = disposition.match(/filename="?([^"]+)"?/i);
    const filename = match?.[1] || fallbackFilename || `record_${id}.bin`;
    const blob = await response.blob();
    let textPreview = '';
    try {
      const rawText = await blob.text();
      // Only show printable text preview
      if (rawText && /^[\x09\x0A\x0D\x20-\x7E\u00A0-\uFFFF]*$/.test(rawText.slice(0, 512))) {
        textPreview = rawText.slice(0, 4000);
      }
    } catch {
      textPreview = '';
    }

    if (triggerBrowserDownload && typeof window !== 'undefined') {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    }

    return { blob, filename, textPreview };
  },

  async verifyRecordIntegrity(id: string): Promise<{
    verified: boolean;
    recordId: string;
    cid: string;
    computedHash?: string;
    expectedHash?: string;
  }> {
    return apiRequest(`/records/${encodeURIComponent(id)}/verify-integrity`);
  },

  async uploadRecord(payload: UploadRecordPayload): Promise<MedicalRecord> {
    const formData = new FormData();
    if (payload.file) {
      formData.append('file', payload.file);
    } else {
      const content = payload.description || payload.title || 'Medrynx clinical record payload';
      const blob = new Blob([content], { type: 'text/plain' });
      formData.append('file', blob, `${payload.title.replace(/\s+/g, '_')}.txt`);
    }
    formData.append('title', payload.title);
    formData.append('category', payload.category);
    if (payload.description) {
      formData.append('description', payload.description);
    }
    return apiRequest<MedicalRecord>('/records', {
      method: 'POST',
      body: formData,
    });
  },

  async getRecordVersions(recordId: string): Promise<RecordVersionItem[]> {
    return apiRequest<RecordVersionItem[]>(`/records/${recordId}/versions`);
  },

  async uploadRecordVersion(payload: UploadVersionPayload): Promise<RecordVersionItem> {
    const formData = new FormData();
    formData.append('file', payload.file);
    if (payload.changeSummary) {
      formData.append('changeSummary', payload.changeSummary);
    }
    return apiRequest<RecordVersionItem>(`/records/${payload.recordId}/versions`, {
      method: 'POST',
      body: formData,
    });
  },

  async tombstoneRecord(recordId: string): Promise<{ success: boolean; message: string; txHash?: string }> {
    return apiRequest<{ success: boolean; message: string; txHash?: string }>(`/records/${recordId}`, {
      method: 'DELETE',
    });
  },

  async exportFhirResource(resourceType: string, id: string): Promise<unknown> {
    return apiRequest<unknown>(`/fhir/${resourceType}/${id}`);
  },

  async exportPatientFhirBundle(patientId: string): Promise<unknown> {
    return apiRequest<unknown>(`/fhir/export/patient/${patientId}`);
  },
};
