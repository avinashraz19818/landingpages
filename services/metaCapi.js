const axios = require('axios');
const crypto = require('crypto');

class MetaCapiService {
  constructor() {}

  // Helper to hash user data with SHA-256 according to Meta CAPI specification
  hash(value) {
    if (!value) return undefined;
    return crypto.createHash('sha256').update(value.toString().trim().toLowerCase()).digest('hex');
  }

  // Construct proper _fbc if raw fbclid is provided
  formatFbc(fbclid, existingFbc) {
    if (existingFbc && existingFbc.startsWith('fb.1.')) {
      return existingFbc;
    }
    if (fbclid) {
      return `fb.1.${Date.now()}.${fbclid}`;
    }
    return undefined;
  }

  // Fire CAPI event to Meta
  async fireEvent({
    pixelId,
    capiToken,
    eventName = 'Lead',
    testEventCode = '',
    eventSourceUrl = 'https://t.me',
    ip,
    userAgent,
    fbc,
    fbp,
    fbclid,
    externalId,
    customData = {}
  }) {
    if (!pixelId || !capiToken) {
      throw new Error('Meta Pixel ID and Conversions API Access Token are required');
    }

    const formattedFbc = this.formatFbc(fbclid, fbc);

    const userData = {
      client_ip_address: ip || undefined,
      client_user_agent: userAgent || undefined,
    };

    if (formattedFbc) {
      userData.fbc = formattedFbc;
    }
    if (fbp) {
      userData.fbp = fbp;
    }
    if (externalId) {
      userData.external_id = this.hash(externalId.toString());
    }

    const eventPayload = {
      event_name: eventName,
      event_time: Math.floor(Date.now() / 1000),
      event_source_url: eventSourceUrl,
      action_source: 'website',
      user_data: userData,
      custom_data: {
        currency: 'USD',
        value: 1.0,
        content_name: 'Telegram Channel Join Request',
        ...customData
      }
    };

    const requestBody = {
      data: [eventPayload]
    };

    if (testEventCode && testEventCode.trim()) {
      requestBody.test_event_code = testEventCode.trim();
    }

    const url = `https://graph.facebook.com/v19.0/${pixelId.trim()}/events?access_token=${capiToken.trim()}`;

    try {
      const response = await axios.post(url, requestBody, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      return {
        success: true,
        events_received: response.data?.events_received || 1,
        fbtrace_id: response.data?.fbtrace_id,
        payloadSent: eventPayload
      };
    } catch (err) {
      const errorDetail = err.response?.data || err.message;
      console.error('Meta CAPI Error:', JSON.stringify(errorDetail));
      return {
        success: false,
        error: errorDetail,
        payloadSent: eventPayload
      };
    }
  }

  // Quick test connection
  async testConnection(pixelId, capiToken, testEventCode) {
    return await this.fireEvent({
      pixelId,
      capiToken,
      eventName: 'Lead',
      testEventCode,
      eventSourceUrl: 'https://test.local',
      ip: '127.0.0.1',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) TestAgent',
      externalId: 'test_user_123',
      customData: {
        is_test: true,
        note: '0-Fake-Click verification test'
      }
    });
  }
}

module.exports = new MetaCapiService();
