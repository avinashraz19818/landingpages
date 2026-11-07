const axios = require('axios');

class TelegramService {
  constructor() {}

  getApiUrl(botToken) {
    return `https://api.telegram.org/bot${botToken.trim()}`;
  }

  // Verify Bot Token
  async testBot(botToken) {
    if (!botToken) throw new Error('Telegram Bot Token is missing');
    const res = await axios.get(`${this.getApiUrl(botToken)}/getMe`, { timeout: 8000 });
    if (res.data && res.data.ok) {
      return res.data.result;
    }
    throw new Error('Invalid bot token response');
  }

  // Verify Channel & Bot Admin Permissions
  async testChannel(botToken, chatId) {
    if (!botToken || !chatId) throw new Error('Bot token or Chat ID is missing');
    const res = await axios.get(`${this.getApiUrl(botToken)}/getChat`, {
      params: { chat_id: chatId.trim() },
      timeout: 8000
    });
    if (res.data && res.data.ok) {
      return res.data.result;
    }
    throw new Error('Unable to access channel with this bot');
  }

  // Create a Unique Join Request Link
  // creates_join_request=true is CRITICAL: it requires the user to click "Request to Join"
  // which fires the chat_join_request webhook to our server!
  async createJoinRequestLink(botToken, chatId, linkName, expireMinutes = 1440) {
    if (!botToken || !chatId) {
      throw new Error('Bot Token and Chat ID are required to generate invite links');
    }

    const payload = {
      chat_id: chatId.trim(),
      name: linkName.substring(0, 32), // Telegram limits link names to 32 chars
      creates_join_request: true,
      expire_date: Math.floor(Date.now() / 1000) + (expireMinutes * 60)
    };

    const res = await axios.post(`${this.getApiUrl(botToken)}/createChatInviteLink`, payload, {
      timeout: 10000
    });

    if (res.data && res.data.ok) {
      return res.data.result; // contains .invite_link
    }
    throw new Error(res.data?.description || 'Failed to create invite link on Telegram');
  }

  // Approve a Member's Join Request
  async approveJoinRequest(botToken, chatId, userId) {
    try {
      const res = await axios.post(`${this.getApiUrl(botToken)}/approveChatJoinRequest`, {
        chat_id: chatId.trim(),
        user_id: userId
      }, { timeout: 8000 });
      return res.data && res.data.ok;
    } catch (err) {
      console.error('approveJoinRequest error:', err.response?.data || err.message);
      return false;
    }
  }

  // Send a Message (e.g. Welcome DM to the user)
  async sendMessage(botToken, userId, text) {
    try {
      const res = await axios.post(`${this.getApiUrl(botToken)}/sendMessage`, {
        chat_id: userId,
        text: text,
        parse_mode: 'HTML'
      }, { timeout: 8000 });
      return res.data && res.data.ok;
    } catch (err) {
      console.warn('sendMessage error (User might have privacy settings):', err.message);
      return false;
    }
  }

  // Set Telegram Webhook to our Server
  async setWebhook(botToken, webhookUrl) {
    const res = await axios.post(`${this.getApiUrl(botToken)}/setWebhook`, {
      url: webhookUrl,
      allowed_updates: ['chat_join_request', 'message']
    }, { timeout: 10000 });
    return res.data;
  }

  // Get current webhook info
  async getWebhookInfo(botToken) {
    const res = await axios.get(`${this.getApiUrl(botToken)}/getWebhookInfo`, { timeout: 8000 });
    return res.data;
  }
}

module.exports = new TelegramService();
