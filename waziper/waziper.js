const fs = require("fs");
const http = require("http");
const qrimg = require("qr-image");
const express = require("express");
const rimraf = require("rimraf");
const moment = require("moment-timezone");
const bodyParser = require("body-parser");
const publicIp = require("ip");
const cors = require("cors");
const spintax = require("spintax");
const Boom = require("@hapi/boom");
const P = require("pino");
const app = express();
const axios = require("axios");
const server = http.createServer(app);
const { Server } = require("socket.io");
const config = require("./../config.js");
const Common = require("./common.js");
const cron = require("node-cron");

// Enhanced Message Logging
const messageLogger = require("../simple-message-logger.js");

const bulks = {};
const chatbots = {};
const limit_messages = {};
const stats_history = {};
const sessions = {};
const new_sessions = {};
const connecting_sessions = {}; // Track sessions currently connecting
const session_dir = __dirname + "/../sessions/";
let verify_next = 0;
let verify_response = false;
let verified = true; // Bypass license verification for testing
let chatbot_delay = 1000;

const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

app.use(
  bodyParser.urlencoded({
    extended: true,
    limit: "50mb",
  })
);

const {
  default: makeWASocket,
  BufferJSON,
  useMultiFileAuthState,
  DisconnectReason,
  Browsers,
  delay,
} = require("@whiskeysockets/baileys");

const WAZIPER = {
  io: io,
  app: app,
  server: server,
  cors: cors(config.cors),

  makeWASocket: async function (instance_id) {
    // Prevent multiple connections for same instance
    if (connecting_sessions[instance_id]) {
      console.log("Connection already in progress for instance:", instance_id);
      return connecting_sessions[instance_id];
    }

    // Clean up existing session if any
    if (sessions[instance_id]) {
      try {
        if (sessions[instance_id].ws && sessions[instance_id].ws.readyState === 1) {
          sessions[instance_id].ws.close();
        }
        sessions[instance_id].end?.();
      } catch (error) {
        console.log("Error cleaning up existing session:", error.message);
      }
      delete sessions[instance_id];
    }

    console.log("Creating new WhatsApp socket for instance:", instance_id);
    
    const { state, saveCreds } = await useMultiFileAuthState(
      "sessions/" + instance_id
    );

    const WA = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      logger: P({ level: "silent" }),
      browser: Browsers.macOS("Desktop"),
      markOnlineOnConnect: false,
      generateHighQualityLinkPreview: true,
      syncFullHistory: false,
      shouldSyncHistoryMessage: () => false,
      connectTimeoutMs: 60000, // 60 seconds timeout
      defaultQueryTimeoutMs: 60000, // 60 seconds timeout
      keepAliveIntervalMs: 30000, // 30 seconds keep alive
      patchMessageBeforeSending: (message) => {
        const requiresPatch = !!(
          message.buttonsMessage ||
          // || message.templateMessage
          message.listMessage
        );
        if (requiresPatch) {
          message = {
            viewOnceMessage: {
              message: {
                messageContextInfo: {
                  deviceListMetadataVersion: 2,
                  deviceListMetadata: {},
                },
                ...message,
              },
            },
          };
        }
        return message;
      },
    });

    // Mark as connecting with timestamp
    WA.createdAt = Date.now();
    connecting_sessions[instance_id] = WA;

    WA.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect, qr, isNewLogin } = update;
      console.log(
        "Connection update:",
        connection,
        "QR:",
        qr ? "Generated" : "None"
      );

      /*
       * Get QR Code
       */
      if (qr !== undefined) {
        console.log("QR Code generated for instance:", instance_id);
        WA.qrcode = qr;
        if (new_sessions[instance_id] == undefined)
          new_sessions[instance_id] = new Date().getTime() / 1000 + 300;
      }

      /*
       * Login successful - reload session
       */
      if (isNewLogin) {
        console.log("New login detected, reloading session");
        setTimeout(async () => {
          sessions[instance_id] = await WAZIPER.makeWASocket(instance_id);
        }, 1000);
      }

      if (lastDisconnect?.error) {
        console.log("Last disconnect error:", lastDisconnect.error);
        const statusCode = lastDisconnect.error.output?.statusCode;
        if (DisconnectReason.connectionClosed == statusCode) {
          //await WAZIPER.makeWASocket(instance_id);
        }

        if (DisconnectReason.restartRequired == statusCode) {
          //sessions[instance_id] = await WAZIPER.makeWASocket(instance_id);
        }

        if (DisconnectReason.loggedOut == statusCode) {
          await WAZIPER.logout(instance_id);
        } else if (statusCode === 440) {
          // Handle conflict error specifically
          console.log("Conflict error detected, cleaning up and waiting before retry");
          
          // Clean up current session
          if (sessions[instance_id]) {
            try {
              if (sessions[instance_id].ws && sessions[instance_id].ws.readyState === 1) {
                sessions[instance_id].ws.close();
              }
              sessions[instance_id].end?.();
            } catch (error) {
              console.log("Error during cleanup:", error.message);
            }
          }
          
          delete sessions[instance_id];
          delete chatbots[instance_id];
          delete bulks[instance_id];
          delete connecting_sessions[instance_id];
          
          // Wait longer before retry to avoid conflicts
          setTimeout(async () => {
            if (!sessions[instance_id] && !connecting_sessions[instance_id]) {
              console.log("Retrying connection after conflict for instance:", instance_id);
              sessions[instance_id] = await WAZIPER.makeWASocket(instance_id);
            }
          }, 10000); // Wait 10 seconds
        } else {
          console.log("Handling other disconnect reasons, status code:", statusCode);
          
          // Clean up current session
          if (sessions[instance_id]) {
            try {
              if (sessions[instance_id].ws && sessions[instance_id].ws.readyState === 1) {
                sessions[instance_id].ws.close();
              }
              sessions[instance_id].end?.();
            } catch (error) {
              console.log("Error during cleanup:", error.message);
            }
          }

          delete sessions[instance_id];
          delete chatbots[instance_id];
          delete bulks[instance_id];
          delete connecting_sessions[instance_id];
          
          // Retry with delay
          setTimeout(async () => {
            if (!sessions[instance_id] && !connecting_sessions[instance_id]) {
              sessions[instance_id] = await WAZIPER.makeWASocket(instance_id);
            }
          }, 5000);
        }
      }

      /*
       * Connection status
       */
      if (connection === "close") {
        console.log("Connection closed, reason:", lastDisconnect?.error);
        
        // Remove from connecting sessions
        delete connecting_sessions[instance_id];

        if (lastDisconnect?.error) {
          const statusCode = lastDisconnect.error.output?.statusCode;
          if (statusCode === DisconnectReason.loggedOut) {
            console.log("User logged out, cleaning session");
            const SESSION_PATH = session_dir + instance_id;
            if (fs.existsSync(SESSION_PATH)) {
              rimraf.sync(SESSION_PATH);
            }
            delete sessions[instance_id];
            delete chatbots[instance_id];
            delete bulks[instance_id];
            delete new_sessions[instance_id];
          } else if (statusCode === 440) {
            // Handle conflict specifically - retry after longer delay
            console.log("Conflict detected on close, will retry after 30 seconds");
            delete sessions[instance_id];
            delete chatbots[instance_id];
            delete bulks[instance_id];
            setTimeout(async () => {
              if (!sessions[instance_id] && !connecting_sessions[instance_id]) {
                console.log("Retrying connection after conflict for instance:", instance_id);
                sessions[instance_id] = await WAZIPER.makeWASocket(instance_id);
              }
            }, 30000); // Wait 30 seconds
          } else {
            console.log("Connection closed, will retry with delay");
            delete sessions[instance_id];
            delete chatbots[instance_id];
            delete bulks[instance_id];
            
            // Retry connection after delay, but only if not already connecting
            setTimeout(async () => {
              if (!sessions[instance_id] && !connecting_sessions[instance_id]) {
                sessions[instance_id] = await WAZIPER.makeWASocket(instance_id);
              }
            }, 8000); // Increased delay to 8 seconds
          }
        }
      } else if (connection === "open") {
        console.log("Connection opened successfully");
        console.log("User info:", WA.user);

        if (!WA.user?.name) {
          WA.user.name = Common.get_phone(WA.user.id);
        }

        sessions[instance_id] = WA;
        
        // Remove from connecting sessions as connection is now open
        delete connecting_sessions[instance_id];

        // Remove QR code as connection is established
        if (sessions[instance_id].qrcode) {
          delete sessions[instance_id].qrcode;
          delete new_sessions[instance_id];
        }

        // Update session in database
        const session = await Common.db_get("sp_whatsapp_sessions", [
          { instance_id: instance_id },
          { status: 0 },
        ]);
        console.log("Found session:", session ? "Yes" : "No");

        if (session) {
          console.log("Updating session status to active");
          // Get avatar
          WA.user.avatar = await WAZIPER.get_avatar(WA);

          let account = await Common.db_get("sp_accounts", [
            { token: instance_id },
          ]);
          if (!account) {
            account = await Common.db_get("sp_accounts", [
              { pid: Common.get_phone(WA.user.id, "wid") },
              { team_id: session.team_id },
            ]);
          }

          await Common.update_status_instance(instance_id, WA.user);
          await WAZIPER.add_account(
            instance_id,
            session.team_id,
            WA.user,
            account
          );
          console.log("Session updated successfully");
        }
      } else if (connection === "connecting") {
        console.log("Connecting to WhatsApp...");
      } else {
        console.log("Unknown connection state:", connection);
        // Clean up connecting sessions for unknown states
        if (connection !== "open" && connection !== "connecting") {
          delete connecting_sessions[instance_id];
        }
      }
    });

    WA.ev.on("messages.upsert", async (messages) => {
      WAZIPER.webhook(instance_id, {
        event: "messages.upsert",
        data: messages,
      });
      if (messages.messages != undefined) {
        messages = messages.messages;

        if (messages.length > 0) {
          for (var i = 0; i < messages.length; i++) {
            var message = messages[i];
            var chat_id = message.key.remoteJid;

            if (
              message.key.fromMe === false &&
              message.key.remoteJid != "status@broadcast" &&
              message.message != undefined
            ) {
              var user_type = "user";

              if (chat_id.indexOf("g.us") !== -1) {
                user_type = "group";
              }

              WAZIPER.chatbot(instance_id, user_type, message);
              WAZIPER.autoresponder(instance_id, user_type, message);
            }

            //Add Groups for Export participants
            if (message.message != undefined) {
              if (chat_id.includes("@g.us")) {
                if (sessions[instance_id].groups == undefined) {
                  sessions[instance_id].groups = [];
                }

                var newGroup = true;
                sessions[instance_id].groups.forEach(async (group) => {
                  if (group.id == chat_id) {
                    newGroup = false;
                  }
                });

                if (newGroup) {
                  await WA.groupMetadata(chat_id)
                    .then(async (group) => {
                      sessions[instance_id].groups.push({
                        id: group.id,
                        name: group.subject,
                        size: group.size,
                        desc: group.desc,
                        participants: group.participants,
                      });
                    })
                    .catch((err) => {});
                }
              }
            }
          }
        }
      }
    });

    WA.ev.on("contacts.update", async (contacts) => {
      WAZIPER.webhook(instance_id, {
        event: "contacts.update",
        data: contacts,
      });
    });

    WA.ev.on("contacts.upsert", async (contacts) => {
      WAZIPER.webhook(instance_id, {
        event: "contacts.upsert",
        data: contacts,
      });
    });

    WA.ev.on("messages.update", async (messages) => {
      WAZIPER.webhook(instance_id, {
        event: "messages.update",
        data: messages,
      });
    });

    WA.ev.on("groups.update", async (group) => {
      WAZIPER.webhook(instance_id, { event: "groups.update", data: group });
    });

    WA.ev.on("creds.update", saveCreds);

    return WA;
  },

  session: async function (instance_id, reset) {
    console.log(
      "Creating/getting session for instance:",
      instance_id,
      "reset:",
      reset
    );
    
    // If reset is requested, clean up existing session
    if (reset && sessions[instance_id]) {
      try {
        if (sessions[instance_id].ws && sessions[instance_id].ws.readyState === 1) {
          sessions[instance_id].ws.close();
        }
        sessions[instance_id].end?.();
      } catch (error) {
        console.log("Error during reset cleanup:", error.message);
      }
      delete sessions[instance_id];
      delete connecting_sessions[instance_id];
    }
    
    // Check if already connecting
    if (connecting_sessions[instance_id]) {
      console.log("Session already connecting for instance:", instance_id);
      return connecting_sessions[instance_id];
    }
    
    if (sessions[instance_id] == undefined || reset) {
      console.log("Creating new WhatsApp socket for instance:", instance_id);
      sessions[instance_id] = await WAZIPER.makeWASocket(instance_id);
    }

    return sessions[instance_id];
  },

  instance: async function (access_token, instance_id, login, res, callback) {
    var time_now = Math.floor(new Date().getTime() / 1000);

    // Bypass license verification for development
    verified = true;

    if (false && verify_next < time_now) {
      var options = await Common.db_query(
        `SELECT value FROM sp_options WHERE name = 'base_url'`
      );
      if (!options) {
        if (res) {
          return res.json({
            status: "error",
            message:
              "Whoop! The license provided is not valid, please contact the author for assistance",
          });
        } else {
          return callback(false);
        }
      }

      var base_url = options.value;
      var license = await Common.db_query(
        `SELECT * FROM sp_purchases WHERE item_id = '32290038' OR item_id = '32399061'`
      );
      if (!license) {
        if (res) {
          return res.json({
            status: "error",
            message:
              "Whoop!!The license provided is not valid, please contact the author for assistance",
          });
        } else {
          return callback(false);
        }
      }

      var ip = await publicIp.address();
      var check_license = await new Promise(async (resolve, reject) => {
        axios
          .get(
            "https://stackposts.com/api/check?purchase_code=" +
              license.purchase_code +
              "&website=" +
              base_url +
              "&ip=" +
              ip
          )
          .then((response) => {
            if (response.status === 200) {
              verify_response = response.data;
              verified = false;
              return resolve(response.data);
            } else {
              verified = true;
              return resolve(false);
            }
          })
          .catch((err) => {
            verified = true;
            return resolve(false);
          });
      });
    }

    if (verify_next < time_now) {
      verify_next = time_now + 600;
    }

    if (verify_response) {
      if (verify_response.status == "error") {
        if (res) {
          return res.json({
            status: "error",
            message: verify_response.message,
          });
        } else {
          return callback(false);
        }
      }
    }

    if (!verified) {
      if (res) {
        return res.json({
          status: "error",
          message:
            "Whoop!!! The license provided is not valid, please contact the author for assistance",
        });
      } else {
        return callback(false);
      }
    }

    if (instance_id == undefined && res != undefined) {
      if (res) {
        return res.json({
          status: "error",
          message:
            "The Instance ID must be provided for the process to be completed",
        });
      } else {
        return callback(false);
      }
    }

    var team = await Common.db_get("sp_team", [{ ids: access_token }]);

    if (!team) {
      if (res) {
        return res.json({
          status: "error",
          message: "The authentication process has failed",
        });
      } else {
        return callback(false);
      }
    }

    var session = await Common.db_get("sp_whatsapp_sessions", [
      { instance_id: instance_id },
      { team_id: team.id },
    ]);

    if (!session) {
      Common.db_update("sp_accounts", [{ status: 0 }, { token: instance_id }]);

      if (res) {
        return res.json({
          status: "error",
          message: "The Instance ID provided has been invalidated",
        });
      } else {
        return callback(false);
      }
    }

    if (login) {
      var SESSION_PATH = session_dir + instance_id;
      if (fs.existsSync(SESSION_PATH)) {
        rimraf.sync(SESSION_PATH);
      }
      delete sessions[instance_id];
      delete chatbots[instance_id];
      delete bulks[instance_id];
    }

    sessions[instance_id] = await WAZIPER.session(instance_id, false);
    return callback(sessions[instance_id]);
  },

  webhook: async function (instance_id, data) {
    var tb_webhook = await Common.db_query(
      "SHOW TABLES LIKE 'sp_whatsapp_webhook'"
    );
    if (tb_webhook) {
      var webhook = await Common.db_query(
        "SELECT * FROM sp_whatsapp_webhook WHERE status = 1 AND instance_id = '" +
          instance_id +
          "'"
      );
      if (webhook) {
        axios
          .post(webhook.webhook_url, { instance_id: instance_id, data: data })
          .then((res) => {})
          .catch((err) => {});
      }
    }
  },

  get_qrcode: async function (instance_id, res) {
    console.log("Getting QR code for instance:", instance_id);

    let client = sessions[instance_id];
    if (!client) {
      console.log(
        "Client not found, creating new session for instance:",
        instance_id
      );
      client = await WAZIPER.session(instance_id, true);
    }

    if (client.qrcode && client.qrcode === false) {
      return res.json({
        status: "error",
        message: "It seems that you have logged in successfully",
      });
    }

    // Wait for QR code generation with better timeout handling
    console.log("Waiting for QR code generation...");
    let attempts = 0;
    const maxAttempts = 60; // 60 seconds timeout

    while (attempts < maxAttempts) {
      if (client.qrcode && typeof client.qrcode === "string") {
        console.log(
          "QR code generated successfully for instance:",
          instance_id
        );
        try {
          const code = qrimg.imageSync(client.qrcode, { type: "png" });
          return res.json({
            status: "success",
            message: "Success",
            base64: "data:image/png;base64," + code.toString("base64"),
          });
        } catch (error) {
          console.log("QR code image generation error:", error);
          return res.json({
            status: "error",
            message: "Failed to generate QR code image",
          });
        }
      }

      await Common.sleep(1000);
      attempts++;

      if (attempts % 10 === 0) {
        console.log("Still waiting for QR code... attempt", attempts);
      }

      // Refresh client reference in case it was updated
      client = sessions[instance_id];
      if (!client) {
        console.log("Client session lost during QR generation");
        return res.json({
          status: "error",
          message: "Session lost during QR code generation",
        });
      }
    }

    console.log("QR code generation timeout for instance:", instance_id);
    return res.json({
      status: "error",
      message: "QR code generation timeout. Please try again.",
    });
  },

  get_info: async function (instance_id, res) {
    var client = sessions[instance_id];
    if (client != undefined && client.user != undefined) {
      if (client.user.avatar == undefined) await Common.sleep(1500);
      client.user.avatar = await WAZIPER.get_avatar(client);
      return res.json({
        status: "success",
        message: "Success",
        data: client.user,
      });
    } else {
      return res.json({ status: "error", message: "Error", relogin: true });
    }
  },

  get_avatar: async function (client) {
    return Common.get_avatar(client.user.name);
  },

  relogin: async function (instance_id, res) {
    if (sessions[instance_id]) {
      var readyState = await WAZIPER.waitForOpenConnection(
        sessions[instance_id].ws
      );
      if (readyState === 1) {
        sessions[instance_id].end();
      }

      delete sessions[instance_id];
      delete chatbots[instance_id];
      delete bulks[instance_id];
    }

    await WAZIPER.session(instance_id, true);
  },

  logout: async function (instance_id, res) {
    Common.db_delete("sp_whatsapp_sessions", [{ instance_id: instance_id }]);
    Common.db_update("sp_accounts", [{ status: 0 }, { token: instance_id }]);

    // Clean up connecting sessions
    delete connecting_sessions[instance_id];

    if (sessions[instance_id]) {
      try {
        var readyState = await WAZIPER.waitForOpenConnection(
          sessions[instance_id].ws
        );
        if (readyState === 1) {
          sessions[instance_id].ws.close();
        }
        sessions[instance_id].end?.();
      } catch (error) {
        console.log("Error during logout cleanup:", error.message);
      }

      var SESSION_PATH = session_dir + instance_id;
      if (fs.existsSync(SESSION_PATH)) {
        rimraf.sync(SESSION_PATH);
      }
      delete sessions[instance_id];
      delete chatbots[instance_id];
      delete bulks[instance_id];

      if (res != undefined) {
        return res.json({ status: "success", message: "Success" });
      }
    } else {
      if (res != undefined) {
        return res.json({
          status: "error",
          message: "This account seems to have logged out before.",
        });
      }
    }
  },

  waitForOpenConnection: async function (socket) {
    return new Promise((resolve, reject) => {
      const maxNumberOfAttempts = 10;
      const intervalTime = 200; //ms

      let currentAttempt = 0;
      const interval = setInterval(() => {
        if (currentAttempt > maxNumberOfAttempts - 1) {
          clearInterval(interval);
          resolve(0);
        } else if (socket && socket.readyState === socket.OPEN) {
          clearInterval(interval);
          resolve(1);
        }
        currentAttempt++;
      }, intervalTime);
    });
  },

  // Clean up inactive sessions periodically
  cleanupInactiveSessions: function() {
    console.log("Running session cleanup...");
    Object.keys(sessions).forEach(async (instance_id) => {
      const session = sessions[instance_id];
      if (session && session.ws) {
        try {
          const readyState = await WAZIPER.waitForOpenConnection(session.ws);
          if (readyState === 0) {
            console.log("Cleaning up inactive session:", instance_id);
            delete sessions[instance_id];
            delete chatbots[instance_id];
            delete bulks[instance_id];
            delete connecting_sessions[instance_id];
          }
        } catch (error) {
          console.log("Error checking session state:", error.message);
          delete sessions[instance_id];
          delete connecting_sessions[instance_id];
        }
      }
    });
    
    // Clean up stale connecting sessions (older than 2 minutes)
    const now = Date.now();
    Object.keys(connecting_sessions).forEach((instance_id) => {
      const session = connecting_sessions[instance_id];
      if (session && session.createdAt && (now - session.createdAt) > 120000) {
        console.log("Cleaning up stale connecting session:", instance_id);
        delete connecting_sessions[instance_id];
      }
    });
  },

  get_groups: async function (instance_id, res) {
    var client = sessions[instance_id];
    if (client != undefined && client.groups != undefined) {
      res.json({ status: "success", message: "Success", data: client.groups });
    } else {
      res.json({ status: "success", message: "Success", data: [] });
    }
  },

  bulk_messaging: async function () {
    const d = new Date();
    var time_now = d.getTime() / 1000;
    var items = await Common.db_query(
      `SELECT * FROM sp_whatsapp_schedules WHERE status = 1 AND run <= '` +
        time_now +
        `' AND accounts != '' AND time_post <= '` +
        time_now +
        `' ORDER BY time_post ASC LIMIT 5`,
      false
    );

    if (items) {
      items.forEach(async (item) => {
        await Common.db_update("sp_whatsapp_schedules", [
          { run: time_now + 30 },
          { id: item.id },
        ]);
      });

      items.forEach(async (item) => {
        //Get current hour
        var current_hour = -1;
        if (item.timezone != "") {
          var user_diff = Common.getTZDiff(item.timezone);
          current_hour = d.getHours() + user_diff * -1;
          if (current_hour > 23) {
            current_hour = current_hour - 23;
          }
        }

        //Process next hour
        if (item.schedule_time != "" && current_hour != -1) {
          var schedule_time = JSON.parse(item.schedule_time);
          if (!schedule_time.includes(current_hour.toString())) {
            var next_time = -1;
            var date = new Date(
              (d.getTime() / 1000 + user_diff * -1 * 60 * 60) * 1000
            );
            for (var i = 1; i <= 24; i++) {
              date = Common.roundMinutes(date);
              var hour = date.getHours();
              if (schedule_time.includes(hour.toString())) {
                var minutes = new Date(time_now * 1000).getMinutes();
                var max_minute_rand = minutes > 10 ? 10 : minutes;
                var random_add_minutes = Common.randomIntFromInterval(
                  0,
                  max_minute_rand
                );
                next_time =
                  d.getTime() / 1000 +
                  i * 60 * 60 -
                  (minutes - random_add_minutes) * 60;
                break;
              }
            }

            if (next_time == -1) {
              await Common.db_update("sp_whatsapp_schedules", [
                { status: 2 },
                { id: item.id },
              ]);
            } else {
              await Common.db_update("sp_whatsapp_schedules", [
                { time_post: next_time },
                { id: item.id },
              ]);
            }
            return false;
          }
        }

        if (item.result === null || item.result === "") {
          var query_phone_data = "";
        } else {
          result = JSON.parse(item.result);
          var query_phone_data = [];
          for (var i = 0; i < result.length; i++) {
            query_phone_data.push(result[i].phone_number.toString());
          }
        }

        var params = false;
        var phone_number_item = await Common.get_phone_number(
          item.contact_id,
          query_phone_data
        );

        if (!phone_number_item) {
          //Complete
          await Common.db_update("sp_whatsapp_schedules", [
            { status: 2, run: 0 },
            { id: item.id },
          ]);
          return false;
        }

        //Random account
        var instance_id = false;
        var accounts = JSON.parse(item.accounts);
        var next_account = item.next_account;
        if (
          next_account == null ||
          next_account == "" ||
          next_account >= accounts.length
        )
          next_account = 0;

        var check_account = await Common.get_accounts(accounts.join(","));
        if (check_account && check_account.count == 0) {
          await Common.db_update("sp_whatsapp_schedules", [
            { status: 0 },
            { id: item.id },
          ]);
        }

        await accounts.forEach(async (account, index) => {
          if (!instance_id && index == next_account) {
            var account_item = await Common.db_get("sp_accounts", [
              { id: account },
              { status: 1 },
            ]);
            if (account_item) instance_id = account_item.token;

            phone_number = phone_number_item.phone;
            params = phone_number_item.params;

            if (phone_number.indexOf("g.us") !== -1) {
              var chat_id = phone_number;
            } else {
              //phone_number = await Common.check_especials(phone_number);
              var chat_id = parseInt(phone_number) + "@c.us";
            }

            if (
              account_item &&
              account_item.team_id == phone_number_item.team_id
            ) {
              if (sessions[instance_id] == undefined) {
                Common.db_update("sp_whatsapp_schedules", [
                  { next_account: next_account + 1, run: 1 },
                  { id: item.id },
                ]);
              } else {
                await WAZIPER.auto_send(
                  instance_id,
                  chat_id,
                  phone_number,
                  "bulk",
                  item,
                  params,
                  async function (result) {
                    if (result.stats && result.type == "bulk") {
                      var status = result.status;
                      var new_stats = {
                        phone_number: result.phone_number,
                        status: status,
                      };
                      if (item.result == null || item.result == "") {
                        var result_list = [new_stats];
                      } else {
                        var result_list = JSON.parse(item.result);
                        result_list.push(new_stats);
                      }

                      if (bulks[item.id] == undefined) {
                        bulks[item.id] = {};
                      }

                      if (
                        bulks[item.id].bulk_sent == undefined &&
                        bulks[item.id].bulk_failed == undefined
                      ) {
                        bulks[item.id].bulk_sent = item.sent;
                        bulks[item.id].bulk_failed = item.failed;
                      }

                      bulks[item.id].bulk_sent += status ? 1 : 0;
                      bulks[item.id].bulk_failed += !status ? 1 : 0;

                      //Total sent & failed
                      var total_sent = bulks[item.id].bulk_sent;
                      var total_failed = bulks[item.id].bulk_failed;
                      var total_complete = total_sent + total_failed;

                      //Next time post
                      var now = Math.floor(new Date().getTime() / 1000);
                      var random_time =
                        Math.floor(Math.random() * item.max_delay) +
                        item.min_delay;
                      var next_time = item.time_post + random_time;
                      if (next_time < now) {
                        next_time = now + random_time;
                      }

                      var data = {
                        result: JSON.stringify(result_list),
                        sent: total_sent,
                        failed: total_failed,
                        time_post: next_time,
                        next_account: next_account + 1,
                        run: 0,
                      };

                      await Common.db_update("sp_whatsapp_schedules", [
                        data,
                        { id: item.id },
                      ]);
                    }
                  }
                );
              }
            }
          }
        });
      });
    }
  },

  autoresponder: async function (instance_id, user_type, message) {
    var chat_id = message.key.remoteJid;
    var now = new Date().getTime() / 1000;
    var item = await Common.db_get("sp_whatsapp_autoresponder", [
      { instance_id: instance_id },
      { status: 1 },
    ]);
    if (!item) {
      return false;
    }

    //Accept sent to all/group/user
    switch (item.send_to) {
      case 2:
        if (user_type == "group") return false;
        break;
      case 3:
        if (user_type == "user") return false;
        break;
    }

    //Delay response
    if (sessions[instance_id].lastMsg == undefined) {
      sessions[instance_id].lastMsg = {};
    }

    var check_autoresponder = sessions[instance_id].lastMsg[chat_id];
    sessions[instance_id].lastMsg[chat_id] = message.messageTimestamp;

    if (
      check_autoresponder != undefined &&
      check_autoresponder + item.delay * 60 >= now
    ) {
      return false;
    }

    //Except contacts
    var except_data = [];
    if (item.except != null) {
      var except_data = item.except.split(",");
    }

    if (except_data.length > 0) {
      for (var i = 0; i < except_data.length; i++) {
        if (except_data[i] != "" && chat_id.indexOf(except_data[i]) != -1) {
          return false;
        }
      }
    }

    await WAZIPER.auto_send(
      instance_id,
      chat_id,
      chat_id,
      "autoresponder",
      item,
      false,
      function (result) {}
    );
    return false;
  },

  chatbot: async function (instance_id, user_type, message) {
    var chat_id = message.key.remoteJid;
    var items = await Common.db_fetch("sp_whatsapp_chatbot", [
      { instance_id: instance_id },
      { status: 1 },
      { run: 1 },
    ]);
    if (!items) {
      return false;
    }

    sent = false;

    items.forEach(async (item, index) => {
      if (sent) {
        return false;
      }

      var caption = item.caption;
      var keywords = item.keywords.split(",");
      var content = false;

      if (message.message.templateButtonReplyMessage != undefined) {
        content =
          message.message.templateButtonReplyMessage.selectedDisplayText;
      } else if (message.message.listResponseMessage != undefined) {
        content =
          message.message.listResponseMessage.title +
          " " +
          message.message.listResponseMessage.description;
      } else if (
        typeof message.message.extendedTextMessage != "undefined" &&
        message.message.extendedTextMessage != null
      ) {
        content = message.message.extendedTextMessage.text;
      } else if (
        typeof message.message.imageMessage != "undefined" &&
        message.message.imageMessage != null
      ) {
        content = message.message.imageMessage.caption;
      } else if (
        typeof message.message.videoMessage != "undefined" &&
        message.message.videoMessage != null
      ) {
        content = message.message.videoMessage.caption;
      } else if (typeof message.message.conversation != "undefined") {
        content = message.message.conversation;
      }

      var run = true;

      //Accept sent to all/group/user
      switch (item.send_to) {
        case 2:
          if (user_type == "group") run = false;
          break;
        case 3:
          if (user_type == "user") run = false;
          break;
      }

      if (run) {
        if (item.type_search == 1) {
          for (var j = 0; j < keywords.length; j++) {
            if (content) {
              var msg = content.toLowerCase();
              var count_chatbot = 0;
              if (msg.indexOf(keywords[j]) !== -1) {
                //sent = true;
                setTimeout(function () {
                  WAZIPER.auto_send(
                    instance_id,
                    chat_id,
                    chat_id,
                    "chatbot",
                    item,
                    false,
                    function (result) {}
                  );
                }, count_chatbot * chatbot_delay);
                count_chatbot++;
              }
            }
          }
        } else {
          for (var j = 0; j < keywords.length; j++) {
            if (content) {
              var msg = content.toLowerCase();
              var count_chatbot = 0;
              if (msg == keywords[j]) {
                //sent = true;
                setTimeout(function () {
                  WAZIPER.auto_send(
                    instance_id,
                    chat_id,
                    chat_id,
                    "chatbot",
                    item,
                    false,
                    function (result) {}
                  );
                }, count_chatbot * chatbot_delay);
                count_chatbot++;
              }
            }
          }
        }
      }
    });
  },

  send_message: async function (instance_id, access_token, req, res) {
    var type = req.query.type;
    var chat_id = req.body.chat_id;
    var media_url = req.body.media_url;
    var caption = req.body.caption;
    var filename = req.body.filename;
    var team = await Common.db_get("sp_team", [{ ids: access_token }]);

    if (!team) {
      return res.json({
        status: "error",
        message: "The authentication process has failed",
      });
    }

    item = {
      team_id: team.id,
      type: 1,
      caption: caption,
      media: media_url,
      filename: filename,
    };

    await WAZIPER.auto_send(
      instance_id,
      chat_id,
      chat_id,
      "api",
      item,
      false,
      function (result) {
        console.log(result);
        if (result) {
          if (result.message != undefined) {
            result.message.status = "SUCCESS";
          }
          return res.json({
            status: "success",
            message: "Success",
            message: result.message,
          });
        } else {
          return res.json({ status: "error", message: "Error" });
        }
      }
    );
  },

  auto_send: async function (
    instance_id,
    chat_id,
    phone_number,
    type,
    item,
    params,
    callback
  ) {
    var limit = await WAZIPER.limit(item, type);
    if (!limit) {
      return callback({
        status: 0,
        stats: false,
        message:
          "The number of messages you have sent per month has exceeded the maximum limit",
      });
    }

    switch (item.type) {
      //Button
      case 2:
        var template = await WAZIPER.button_template_handler(
          item.template,
          params
        );
        if (template) {
          sessions[instance_id]
            .sendMessage(chat_id, template, {
              ephemeralExpiration: 604800,
            })
            .then(async (message) => {
              callback({
                status: 1,
                type: type,
                phone_number: phone_number,
                stats: true,
              });
              WAZIPER.stats(instance_id, type, item, 1);
            })
            .catch((err) => {
              callback({
                status: 0,
                type: type,
                phone_number: phone_number,
                stats: true,
              });
              WAZIPER.stats(instance_id, type, item, 0);
            });
        }
        break;
      //List Messages
      case 3:
        var template = await WAZIPER.list_message_template_handler(
          item.template,
          params
        );
        if (template) {
          sessions[instance_id]
            .sendMessage(chat_id, template, {
              ephemeralExpiration: 604800,
            })
            .then(async (message) => {
              callback({
                status: 1,
                type: type,
                phone_number: phone_number,
                stats: true,
              });
              WAZIPER.stats(instance_id, type, item, 1);
            })
            .catch((err) => {
              callback({
                status: 0,
                type: type,
                phone_number: phone_number,
                stats: true,
              });
              WAZIPER.stats(instance_id, type, item, 0);
            });
        }
        break;
      //Media & Text
      default:
        var caption = spintax.unspin(item.caption);
        caption = Common.params(params, caption);
        if (item.media != "" && item.media) {
          var mime = Common.ext2mime(item.media);
          var post_type = Common.post_type(mime, 1);
          var filename =
            item.filename != undefined
              ? item.filename
              : Common.get_file_name(item.media);
          switch (post_type) {
            case "videoMessage":
              var data = {
                video: { url: item.media },
                caption: caption,
              };
              break;

            case "imageMessage":
              var data = {
                image: { url: item.media },
                caption: caption,
              };
              break;

            case "audioMessage":
              var data = {
                audio: { url: item.media },
                caption: caption,
              };
              break;

            default:
              var data = {
                document: { url: item.media },
                fileName: filename,
                caption: caption,
              };
              break;
          }

          sessions[instance_id]
            .sendMessage(chat_id, data)
            .then(async (message) => {
              // Log success
              messageLogger.logSuccess(instance_id, phone_number, post_type, message.key?.id);
              
              callback({
                status: 1,
                type: type,
                phone_number: phone_number,
                stats: true,
                message: message,
              });
              WAZIPER.stats(instance_id, type, item, 1);
            })
            .catch((err) => {
              // Log failure with detailed error info
              messageLogger.logFailure(instance_id, phone_number, post_type, err, {
                hasMedia: true,
                mediaType: post_type,
                caption: caption ? caption.substring(0, 100) : null
              });
              
              callback({
                status: 0,
                type: type,
                phone_number: phone_number,
                stats: true,
                error: err.message,
                errorType: messageLogger.parseError(err).type
              });
              WAZIPER.stats(instance_id, type, item, 0);
            });
        } else {
          sessions[instance_id]
            .sendMessage(chat_id, { text: caption })
            .then((message) => {
              // Log success
              messageLogger.logSuccess(instance_id, phone_number, "text", message.key?.id);
              
              callback({
                status: 1,
                type: type,
                phone_number: phone_number,
                stats: true,
                message: message,
              });
              WAZIPER.stats(instance_id, type, item, 1);
            })
            .catch((err) => {
              // Log failure with detailed error info
              messageLogger.logFailure(instance_id, phone_number, "text", err, {
                hasMedia: false,
                textLength: caption ? caption.length : 0
              });
              
              callback({
                status: 0,
                type: type,
                phone_number: phone_number,
                stats: true,
                error: err.message,
                errorType: messageLogger.parseError(err).type
              });
              WAZIPER.stats(instance_id, type, item, 0);
            });
        }
    }
  },

  limit: async function (item, type) {
    var time_now = Math.floor(new Date().getTime() / 1000);

    //
    var team = await Common.db_query(
      `SELECT owner FROM sp_team WHERE id = '` + item.team_id + `'`
    );
    if (!team) {
      return false;
    }

    var user = await Common.db_query(
      `SELECT expiration_date FROM sp_users WHERE id = '` + team.owner + `'`
    );
    if (!user) {
      return false;
    }

    if (user.expiration_date != 0 && user.expiration_date < time_now) {
      return false;
    }

    /*
     * Stats
     */
    if (stats_history[item.team_id] == undefined) {
      stats_history[item.team_id] = {};
      var current_stats = await Common.db_get("sp_whatsapp_stats", [
        { team_id: item.team_id },
      ]);
      if (current_stats) {
        stats_history[item.team_id].wa_total_sent_by_month =
          current_stats.wa_total_sent_by_month;
        stats_history[item.team_id].wa_total_sent = current_stats.wa_total_sent;
        stats_history[item.team_id].wa_chatbot_count =
          current_stats.wa_chatbot_count;
        stats_history[item.team_id].wa_autoresponder_count =
          current_stats.wa_autoresponder_count;
        stats_history[item.team_id].wa_api_count = current_stats.wa_api_count;
        stats_history[item.team_id].wa_bulk_total_count =
          current_stats.wa_bulk_total_count;
        stats_history[item.team_id].wa_bulk_sent_count =
          current_stats.wa_bulk_sent_count;
        stats_history[item.team_id].wa_bulk_failed_count =
          current_stats.wa_bulk_failed_count;
        stats_history[item.team_id].wa_time_reset = current_stats.wa_time_reset;
        stats_history[item.team_id].next_update = current_stats.next_update;
      } else {
        return false;
      }
    }
    //End stats

    if (stats_history[item.team_id] != undefined) {
      if (stats_history[item.team_id].wa_time_reset < time_now) {
        stats_history[item.team_id].wa_total_sent_by_month = 0;
        stats_history[item.team_id].wa_time_reset =
          time_now + 30 * 60 * 60 * 24;
      }

      //if(stats_history[item.team_id].next_update < time_now){
      var current_stats = await Common.db_get("sp_whatsapp_stats", [
        { team_id: item.team_id },
      ]);
      if (current_stats) {
        stats_history[item.team_id].wa_time_reset = current_stats.wa_time_reset;
        if (current_stats.wa_time_reset == 0) {
          stats_history[item.team_id].wa_total_sent_by_month = 0;
          stats_history[item.team_id].wa_time_reset =
            time_now + 30 * 60 * 60 * 24;
        }
      }
      //}
    }

    /*
     * Limit by month
     */
    if (limit_messages[item.team_id] == undefined) {
      limit_messages[item.team_id] = {};
      var team = await Common.db_get("sp_team", [{ id: item.team_id }]);
      if (team) {
        var permissioms = JSON.parse(team.permissions);
        limit_messages[item.team_id].whatsapp_message_per_month = parseInt(
          permissioms.whatsapp_message_per_month
        );
        limit_messages[item.team_id].next_update = 0;
      } else {
        return false;
      }
    }

    if (limit_messages[item.team_id].next_update < time_now) {
      var team = await Common.db_get("sp_team", [{ id: item.team_id }]);
      if (team) {
        var permissioms = JSON.parse(team.permissions);
        limit_messages[item.team_id].whatsapp_message_per_month = parseInt(
          permissioms.whatsapp_message_per_month
        );
        limit_messages[item.team_id].next_update = time_now + 30;
      }
    }
    //End limit by month

    /*
     * Stop all activity when over limit
     */
    if (
      limit_messages[item.team_id] != undefined &&
      stats_history[item.team_id] != undefined
    ) {
      if (
        limit_messages[item.team_id].whatsapp_message_per_month <=
        stats_history[item.team_id].wa_total_sent_by_month
      ) {
        //Stop bulk campaign
        switch (type) {
          case "bulk":
            await Common.db_update("sp_whatsapp_schedules", [
              { run: 0, status: 0 },
              { id: item.id },
            ]);
            break;
        }

        return false;
      }
    }

    return true;
    //End stop all activity when over limit
  },

  stats: async function (instance_id, type, item, status) {
    var time_now = Math.floor(new Date().getTime() / 1000);

    if (stats_history[item.team_id].wa_time_reset < time_now) {
      stats_history[item.team_id].wa_total_sent_by_month = 0;
      stats_history[item.team_id].wa_time_reset = time_now + 30 * 60 * 60 * 24;
    }

    var sent = status ? 1 : 0;
    var failed = !status ? 1 : 0;

    stats_history[item.team_id].wa_total_sent_by_month += sent;
    stats_history[item.team_id].wa_total_sent += sent;

    switch (type) {
      case "chatbot":
        if (chatbots[item.id] == undefined) {
          chatbots[item.id] = {};
        }

        if (
          chatbots[item.id].chatbot_sent == undefined &&
          chatbots[item.id].chatbot_failed == undefined
        ) {
          chatbots[item.id].chatbot_sent = item.sent;
          chatbots[item.id].chatbot_failed = item.sent;
        }

        chatbots[item.id].chatbot_sent += status ? 1 : 0;
        chatbots[item.id].chatbot_failed += !status ? 1 : 0;

        stats_history[item.team_id].wa_chatbot_count += sent;

        var total_sent = chatbots[item.id].chatbot_sent;
        var total_failed = chatbots[item.id].chatbot_failed;
        var data = {
          sent: total_sent,
          failed: total_failed,
        };

        await Common.db_update("sp_whatsapp_chatbot", [data, { id: item.id }]);
        break;

      case "autoresponder":
        if (
          sessions[instance_id].autoresponder_sent == undefined &&
          sessions[instance_id].autoresponder_failed == undefined
        ) {
          sessions[instance_id].autoresponder_sent = item.sent;
          sessions[instance_id].autoresponder_failed = item.sent;
        }

        sessions[instance_id].autoresponder_sent += status ? 1 : 0;
        sessions[instance_id].autoresponder_failed += !status ? 1 : 0;

        stats_history[item.team_id].wa_autoresponder_count += sent;

        var total_sent = sessions[instance_id].autoresponder_sent;
        var total_failed = sessions[instance_id].autoresponder_failed;
        var data = {
          sent: total_sent,
          failed: total_failed,
        };

        await Common.db_update("sp_whatsapp_autoresponder", [
          data,
          { id: item.id },
        ]);
        break;

      case "bulk":
        stats_history[item.team_id].wa_bulk_total_count += 1;
        stats_history[item.team_id].wa_bulk_sent_count += sent;
        stats_history[item.team_id].wa_bulk_failed_count += failed;
        break;

      case "api":
        stats_history[item.team_id].wa_api_count += sent;
        break;
    }

    /*
     * Update stats
     */
    if (stats_history[item.team_id].next_update < time_now) {
      stats_history[item.team_id].next_update = time_now + 30;
    }
    await Common.db_update("sp_whatsapp_stats", [
      stats_history[item.team_id],
      { team_id: item.team_id },
    ]);
    //End update stats
  },

  button_template_handler: async function (template_id, params) {
    var template = await Common.db_get("sp_whatsapp_template", [
      { id: template_id },
      { type: 2 },
    ]);
    if (template) {
      var data = JSON.parse(template.data);
      if (data.text != undefined) {
        data.text = spintax.unspin(data.text);
        data.text = Common.params(params, data.text);
      }

      if (data.caption != undefined) {
        data.caption = spintax.unspin(data.caption);
        data.caption = Common.params(params, data.caption);
      }

      if (data.footer != undefined) {
        data.footer = spintax.unspin(data.footer);
        data.footer = Common.params(params, data.footer);
      }

      for (var i = 0; i < data.templateButtons.length; i++) {
        if (data.templateButtons[i]) {
          if (data.templateButtons[i].quickReplyButton != undefined) {
            data.templateButtons[i].quickReplyButton.displayText =
              spintax.unspin(
                data.templateButtons[i].quickReplyButton.displayText
              );
            data.templateButtons[i].quickReplyButton.displayText =
              Common.params(
                params,
                data.templateButtons[i].quickReplyButton.displayText
              );
          }

          if (data.templateButtons[i].urlButton != undefined) {
            data.templateButtons[i].urlButton.displayText = spintax.unspin(
              data.templateButtons[i].urlButton.displayText
            );
            data.templateButtons[i].urlButton.displayText = Common.params(
              params,
              data.templateButtons[i].urlButton.displayText
            );
          }

          if (data.templateButtons[i].callButton != undefined) {
            data.templateButtons[i].callButton.displayText = spintax.unspin(
              data.templateButtons[i].callButton.displayText
            );
            data.templateButtons[i].callButton.displayText = Common.params(
              params,
              data.templateButtons[i].callButton.displayText
            );
          }
        }
      }

      return data;
    }

    return false;
  },

  list_message_template_handler: async function (template_id, params) {
    var template = await Common.db_get("sp_whatsapp_template", [
      { id: template_id },
      { type: 1 },
    ]);
    if (template) {
      var data = JSON.parse(template.data);

      if (data.text != undefined) {
        data.text = spintax.unspin(data.text);
        data.text = Common.params(params, data.text);
      }

      if (data.footer != undefined) {
        data.footer = spintax.unspin(data.footer);
        data.footer = Common.params(params, data.footer);
      }

      if (data.title != undefined) {
        data.title = spintax.unspin(data.title);
        data.title = Common.params(params, data.title);
      }

      if (data.buttonText != undefined) {
        data.buttonText = spintax.unspin(data.buttonText);
        data.buttonText = Common.params(params, data.buttonText);
      }

      for (var i = 0; i < data.sections.length; i++) {
        var sessions = data.sections;
        if (data.sections[i]) {
          if (data.sections[i].title != undefined) {
            data.sections[i].title = spintax.unspin(data.sections[i].title);
            data.sections[i].title = Common.params(
              params,
              data.sections[i].title
            );
          }

          for (var j = 0; j < data.sections[i].rows.length; j++) {
            if (data.buttonText != undefined) {
              data.sections[i].rows[j].title = spintax.unspin(
                data.sections[i].rows[j].title
              );
              data.sections[i].rows[j].title = Common.params(
                params,
                data.sections[i].rows[j].title
              );
            }

            if (data.buttonText != undefined) {
              data.sections[i].rows[j].description = spintax.unspin(
                data.sections[i].rows[j].description
              );
              data.sections[i].rows[j].description = Common.params(
                params,
                data.sections[i].rows[j].description
              );
            }
          }
        }
      }

      return data;
    }

    return false;
  },

  live_back: async function () {
    var account = await Common.db_query(`
      SELECT a.changed, a.token as instance_id, a.id, b.ids as access_token 
      FROM sp_accounts as a 
      INNER JOIN sp_team as b ON a.team_id=b.id 
      WHERE a.social_network = 'whatsapp' AND a.login_type = '2' AND a.status = 1 
      ORDER BY a.changed ASC 
      LIMIT 1
    `);

    if (account) {
      var now = new Date().getTime() / 1000;
      await Common.db_update("sp_accounts", [
        { changed: now },
        { id: account.id },
      ]);
      await WAZIPER.instance(
        account.access_token,
        account.instance_id,
        false,
        false,
        async (client) => {
          if (client.user == undefined) {
            await WAZIPER.relogin(account.instance_id);
          }
        }
      );
    }

    //Close new session after 2 minutes
    if (Object.keys(new_sessions).length) {
      Object.keys(new_sessions).forEach(async (instance_id) => {
        var now = new Date().getTime() / 1000;
        if (
          now > new_sessions[instance_id] &&
          sessions[instance_id] &&
          sessions[instance_id].qrcode != undefined
        ) {
          delete new_sessions[instance_id];
          await WAZIPER.logout(instance_id);
        }
      });
    }

    console.log("Total sessions: ", Object.keys(sessions).length);
    console.log("Total queue sessions: ", Object.keys(new_sessions).length);
  },

  add_account: async function (instance_id, team_id, wa_info, account) {
    if (!account) {
      await Common.db_insert_account(instance_id, team_id, wa_info);
    } else {
      var old_instance_id = account.token;

      await Common.db_update_account(instance_id, team_id, wa_info, account.id);

      //Update old session
      if (instance_id != old_instance_id) {
        await Common.db_delete("sp_whatsapp_sessions", [
          { instance_id: old_instance_id },
        ]);
        await Common.db_update("sp_whatsapp_autoresponder", [
          { instance_id: instance_id },
          { instance_id: old_instance_id },
        ]);
        await Common.db_update("sp_whatsapp_chatbot", [
          { instance_id: instance_id },
          { instance_id: old_instance_id },
        ]);
        await Common.db_update("sp_whatsapp_webhook", [
          { instance_id: instance_id },
          { instance_id: old_instance_id },
        ]);
        WAZIPER.logout(old_instance_id);
      }

      var pid = Common.get_phone(wa_info.id, "wid");
      var account_other = await Common.db_query(
        `SELECT id FROM sp_accounts WHERE pid = '` +
          pid +
          `' AND team_id = '` +
          team_id +
          `' AND id != '` +
          account.id +
          `'`
      );
      if (account_other) {
        await Common.db_delete("sp_accounts", [{ id: account_other.id }]);
      }
    }

    /*Create WhatsApp stats for user*/
    var wa_stats = await Common.db_get("sp_whatsapp_stats", [
      { team_id: team_id },
    ]);
    if (!wa_stats) await Common.db_insert_stats(team_id);
  },
};

// Run session cleanup every 5 minutes
cron.schedule("*/5 * * * *", function () {
  WAZIPER.cleanupInactiveSessions();
});

module.exports = WAZIPER;

cron.schedule("*/2 * * * * *", function () {
  WAZIPER.live_back();
});

cron.schedule("*/1 * * * * *", function () {
  WAZIPER.bulk_messaging();
});
