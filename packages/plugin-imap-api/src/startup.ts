import * as fs from 'fs';
import { Base64Decode } from 'base64-stream';
import * as Imap from 'node-imap';
import { simpleParser } from 'mailparser';
import { generateModels } from './connectionResolver';
import { sendContactsMessage, sendInboxMessage } from './messageBroker';
import { IIntegrationDocument } from './models';

const toUpper = thing => {
  return thing && thing.toUpperCase ? thing.toUpperCase() : thing;
};

const findAttachmentParts = (struct, attachments?) => {
  attachments = attachments || [];

  for (var i = 0, len = struct.length, r; i < len; ++i) {
    if (Array.isArray(struct[i])) {
      findAttachmentParts(struct[i], attachments);
    } else {
      if (
        struct[i].disposition &&
        ['INLINE', 'ATTACHMENT'].indexOf(toUpper(struct[i].disposition.type)) >
          -1
      ) {
        attachments.push(struct[i]);
      }
    }
  }
  return attachments;
};

const buildAttMessageFunction = attachment => {
  const filename = attachment.params.name;
  const encoding = attachment.encoding;

  return (msg, seqno) => {
    const prefix = '(#' + seqno + ') ';

    msg.on('body', function(stream, info) {
      //Create a write stream so that we can stream the attachment to file;
      console.log(prefix + 'Streaming this attachment to file', filename, info);

      const writeStream = fs.createWriteStream(
        `/Users/batamar/Downloads/$${filename}`
      );

      writeStream.on('finish', function() {
        console.log(prefix + 'Done writing to file %s', filename);
      });

      // stream.pipe(writeStream); this would write base64 data to the file.
      // so we decode during streaming using
      if (toUpper(encoding) === 'BASE64') {
        // the stream is base64 encoded, so here the stream is decode on the fly and piped to the write stream (file)
        stream.pipe(new Base64Decode()).pipe(writeStream);
      } else {
        // here we have none or some other decoding streamed directly to the file which renders it useless probably
        stream.pipe(writeStream);
      }
    });

    msg.once('end', function() {
      console.log(prefix + 'Finished attachment %s', filename);
    });
  };
};

const listenIntegration = async (
  subdomain: string,
  integration: IIntegrationDocument
) => {
  var imap = new Imap({
    user: integration.user,
    password: integration.password,
    host: integration.host,
    keepalive: { forceNoop: true },
    port: 993,
    tls: true
  });

  const searchMessages = criteria => {
    return new Promise((resolve, reject) => {
      let messages: any = [];

      imap.search(criteria, function(err, results) {
        if (err) throw err;

        let f;

        try {
          f = imap.fetch(results, { bodies: '', struct: true });
        } catch (e) {
          if (e.message.includes('Nothing to fetch')) {
            return resolve([]);
          }

          throw e;
        }

        f.on('message', function(msg) {
          msg.on('body', async function(stream) {
            var buffer = '';

            stream.on('data', function(chunk) {
              buffer += chunk.toString('utf8');
            });

            stream.once('end', async () => {
              messages.push(buffer);
            });
          });

          msg.once('attributes', function(attrs) {
            const attachments = findAttachmentParts(attrs.struct);

            for (let i = 0, len = attachments.length; i < len; ++i) {
              const attachment = attachments[i];

              const f = imap.fetch(attrs.uid, {
                bodies: [attachment.partID],
                struct: true
              });

              f.on('message', buildAttMessageFunction(attachment));
            }
          });
        });

        f.once('error', function(err) {
          reject(err);
        });

        f.once('end', async function() {
          const results: any = [];

          for (const buffer of messages) {
            const parsed = await simpleParser(buffer);
            results.push(parsed);
          }

          resolve(results);
        });
      });
    });
  };

  const saveMessages = async criteria => {
    const models = await generateModels(subdomain);

    const msgs: any = await searchMessages(criteria);

    for (const msg of msgs) {
      const message = await models.Messages.findOne({
        messageId: msg.messageId
      });

      if (message) {
        continue;
      }

      const from = msg.from.value[0].address;
      const prev = await models.Customers.findOne({ email: from });

      let customerId;

      if (!prev) {
        const apiCustomerResponse = await sendContactsMessage({
          subdomain,
          action: 'customers.createCustomer',
          data: {
            integrationId: integration.inboxId,
            primaryEmail: from
          },
          isRPC: true
        });

        await models.Customers.create({
          contactsId: apiCustomerResponse._id,
          email: from
        });

        customerId = apiCustomerResponse._id;
      } else {
        customerId = prev.contactsId;
      }

      let conversationId;

      const relatedMessage = await models.Messages.findOne({
        $or: [
          { messageId: msg.inReplyTo },
          { messageId: { $in: msg.references || [] } },
          { references: { $in: [msg.messageId] } },
          { references: { $in: [msg.inReplyTo] } }
        ]
      });

      if (relatedMessage) {
        conversationId = relatedMessage.inboxConversationId;
      } else {
        const { _id } = await sendInboxMessage({
          subdomain,
          action: 'integrations.receive',
          data: {
            action: 'create-or-update-conversation',
            payload: JSON.stringify({
              integrationId: integration.inboxId,
              customerId,
              createdAt: msg.date,
              content: msg.subject
            })
          },
          isRPC: true
        });

        conversationId = _id;
      }

      await models.Messages.create({
        createdAt: msg.date,
        messageId: msg.messageId,
        inReplyTo: msg.inReplyTo,
        references: msg.references,
        inboxConversationId: conversationId,
        subject: msg.subject,
        body: msg.html,
        to: msg.to.value,
        cc: msg.cc && msg.cc.value,
        bcc: msg.bcc && msg.bcc.value,
        from: msg.from.value,
        attachments: msg.attachments
      });
    }
  };

  imap.once('ready', response => {
    imap.openBox('INBOX', true, async (err, box) => {
      await saveMessages(['UNSEEN', ['SINCE', 'October 10, 2022']]);
    });
  });

  imap.on('mail', async response => {
    console.log('new messages ========', response);
    await saveMessages(['UNSEEN']);
  });

  imap.once('error', function(err) {
    console.log(err);
  });

  imap.once('end', function() {
    console.log('Connection ended');
  });

  imap.connect();
};

const listen = async (subdomain: string) => {
  const models = await generateModels(subdomain);
  const integrations = await models.Integrations.find();

  for (const integration of integrations) {
    await listenIntegration(subdomain, integration);
  }
};

export default listen;
