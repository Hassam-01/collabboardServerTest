import Dm20151123, { SingleSendMailRequest, SingleSendMailResponse } from "@alicloud/dm20151123";
import { Config } from "@alicloud/openapi-client";
import { RuntimeOptions } from "@alicloud/tea-util";
import { createTransport, Transporter } from "nodemailer";
import { EmailSMS } from "../constants/Config";
import { SMSUtils } from "./SMS";
import { createLoggerEmail, Logger, parseError } from "../logger";
import { LoggerEmail } from "../logger/LogConext";

interface EmailClient {
    send(
        tag: string,
        to: string,
        subject: string,
        body: string,
        logger: Logger<LoggerEmail>,
    ): Promise<boolean>;
}

function createAliCloudClient(): EmailClient {
    const config = new Config({
        accessKeyId: EmailSMS.aliCloud.accessId,
        accessKeySecret: EmailSMS.aliCloud.accessSecret,
    });
    config.endpoint = "dm.aliyuncs.com";

    const client = new Dm20151123(config);

    return {
        async send(tagName, toAddress, subject, htmlBody, logger) {
            const request = new SingleSendMailRequest({
                accountName: EmailSMS.aliCloud.accountName,
                addressType: 1,
                tagName,
                replyToAddress: true,
                toAddress,
                subject,
                htmlBody,
            });

            const runtime = new RuntimeOptions({});

            let resp: SingleSendMailResponse;
            try {
                resp = await client.singleSendMailWithOptions(request, runtime);
            } catch (error) {
                logger.error("send message error", parseError(error));
                return false;
            }

            logger.withContext({
                emailDetail: {
                    envId: resp.body.envId || "",
                    requestId: resp.body.requestId || "",
                    messageId: "",
                },
            });

            if (200 <= resp.statusCode && resp.statusCode < 300) {
                logger.debug("send message success");
                return true;
            } else {
                logger.error("send message failed");
                return false;
            }
        },
    };
}

function createSMTPTransport(): EmailClient {
    const transport = createTransport({
        host: EmailSMS.smtp.host,
        port: EmailSMS.smtp.port,
        secure: EmailSMS.smtp.secure,
        from: EmailSMS.smtp.from,
        auth: {
            user: EmailSMS.smtp.auth.user,
            pass: EmailSMS.smtp.auth.pass,
        },
    });

    return {
        async send(_tag, to, subject, html, logger) {
            type ExtractResponse<T> = T extends Transporter<infer K> ? K : never;

            let resp: ExtractResponse<typeof transport>;

            try {
                resp = await transport.sendMail({
                    from: EmailSMS.smtp.from,
                    to,
                    subject,
                    html,
                });
            } catch (error) {
                logger.error("send message error", parseError(error));
                return false;
            }

            logger.withContext({
                emailDetail: {
                    envId: "",
                    requestId: "",
                    messageId: resp.messageId || "",
                },
            });

            logger.debug("send message success: " + resp.response);
            return true;
        },
    };
}

function createEmailClient(): EmailClient {
    if (EmailSMS.type === "smtp") {
        console.log("create SMTP transport ", EmailSMS.smtp.host, EmailSMS.smtp.port);
        return createSMTPTransport();
    }
    if (EmailSMS.type === "aliCloud") {
        console.log("create aliCloud transport", EmailSMS.aliCloud.accountName);
        return createAliCloudClient();
    }
    throw new Error(`unknown email type: ${EmailSMS.type}`);
}

// function getAccountName(): string {
//     if (EmailSMS.type === "aliCloud") {
//         return EmailSMS.aliCloud.accountName;
//     }
//     if (EmailSMS.type === "smtp") {
//         return EmailSMS.smtp.auth.user;
//     }
//     throw new Error(`unknown email type: ${EmailSMS.type}`);
// }

export class Email {
    private static client: EmailClient = createEmailClient();

    public verificationCode = SMSUtils.verificationCode();
    private logger = this.createLoggerEmail();

    public constructor(
        private email: string,
        private options: {
            tagName?: string;
            subject?: string;
            htmlBody?: (email: string, verificationCode: string) => string;
        } = {},
    ) {}

    public send(): Promise<boolean> {
        const {
            tagName = "register",
            subject = "Verification Code",
            htmlBody = (_email, code) => `Your verification code is <b>${code}</b>`,
        } = this.options;

        this.logger.debug("ready send message");
        return Email.client.send(
            tagName,
            this.email,
            subject,
            htmlBody(this.email, this.verificationCode),
            this.logger,
        );
    }

    private createLoggerEmail(): Logger<LoggerEmail> {
        return createLoggerEmail({
            email: {
                accountName: EmailSMS.smtp.from,
                // accountName: getAccountName(),
                email: this.email,
                verificationCode: this.verificationCode,
            },
        });
    }
}

export class EmailUtils {
    public static getSubject(_type: "register" | "reset" | "bind", language?: string): string {
        if (language && language.startsWith("zh")) {
            return "Collab";
        } else {
            return "Collab Verification Code";
        }
    }

    public static getMessage(
        type: "register" | "reset" | "bind",
        email: string,
        code: string,
        language?: string,
    ): string {
        const name = email.split("@")[0];
        const supportEmail = "support@onescreensolutions.com";
        if (language && language.startsWith("espanol")) { 
        }
        // const supportLink = `<a href="mailto:${supportEmail}">${supportEmail}</a>`;
        return `
<div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: auto; border: 1px solid #e0e0e0; padding: 30px; border-radius: 10px;">
  <div style="text-align: center; margin-bottom: 20px;">
    <h2 style="color: #6f3393; margin: 0;">OneScreen Collab</h2>
    <p style="color: #82C341; margin: 5px 0 0 0; font-weight: bold;">Verification Code</p>
  </div>
  <div style="margin-top: 30px; font-size: 16px;">
    <p>Hello, <strong>${name}</strong>!</p>
    ${type === "register"
      ? `<p>Thank you for registering with <strong>OneScreen Collab</strong>. We're excited to have you on board!</p>`
      : ""}
    <p>Please enter the following verification code within the next 10 minutes:</p>
    <div style="text-align: center; margin: 30px 0;">
      <h1 style="font-size: 36px; color: #6f3393; margin: 0;">${code}</h1>
    </div>
    <p>If you have any questions or would like to schedule free training and support, feel free to reach out to us at <a href="mailto:${supportEmail}" style="color: #82C341;">${supportEmail}</a>.</p>
    <p style="margin-top: 40px;">Best regards,<br><strong>The OneScreen Collab Team</strong></p>
  </div>
</div>
        `;
    }}
