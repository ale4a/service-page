import express from "express";
import { IDataQR, IStatusQR } from "types/payment";
import {
  authorize,
  appendToNextColumn,
  getFilledRowCount,
} from "../googleSheet";
import { base64ToPng } from "../helpers";

export const getToken = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => {
  try {
    let token = req.cookies["BNB-TOKEN"];
    if (!token) {
      const accountId = process.env.ACCOUNTID;
      const authorizationId = process.env.AUTHORIZATIONID;
      const dataBody = {
        accountId,
        authorizationId,
      };
      const url =
        "http://test.bnb.com.bo/ClientAuthentication.API/api/v1/auth/token";
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(dataBody),
      });

      if (!response.ok) {
        throw new Error("Failed to fetch token");
      }

      const { message } = await response.json();
      token = message;
      res.cookie("BNB-TOKEN", token, {
        maxAge: 900000,
        httpOnly: true,
      });
    }

    res.locals.token = token;
    next(); // Continue to the next middleware or route handler
  } catch (error) {
    console.log(error);
    res
      .status(500)
      .json({ success: false, message: "Failed to get token" })
      .end();
  }
};

export const getQR = async (req: express.Request, res: express.Response) => {
  try {
    const { gloss, amount, additionalData } = req.body;
    if (!gloss || !amount || !additionalData) {
      return res.sendStatus(400).end();
    }

    const dataBody = {
      currency: "BOB",
      gloss,
      amount,
      singleUse: true,
      expirationDate: "2024-5-6",
      additionalData,
      destinationAccountId: "1",
    };

    const token = res.locals.token;
    console.log({ token });
    const url =
      "http://test.bnb.com.bo/QRSimple.API/api/v1/main/getQRWithImageAsync";

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(dataBody),
    });

    const dataQR: IDataQR = await response.json();
    const { id, qr, success, message } = dataQR;
    if (success) {
      const responseQR = {
        success: true,
        data: {
          qr,
          qrId: id,
        },
        message,
      };
      return res.status(200).json(responseQR).end();
    } else {
      return res
        .status(400)
        .json({
          success: false,
          data: {},
          message,
        })
        .end();
    }
  } catch (error) {
    console.log(error);
    return res.status(400).json({ success: false, data: {} }).end();
  }
};

export const statusQR = async (req: express.Request, res: express.Response) => {
  try {
    const { qrId } = req.params;
    const { idProduct, phone, quantity, amount } = req.body;
    if (!idProduct || !phone || !quantity || !amount || !qrId) {
      return res.sendStatus(400).end();
    }

    const dataBody = {
      qrId: Number(qrId),
    };

    const token = res.locals.token;
    const url =
      "http://test.bnb.com.bo/QRSimple.API/api/v1/main/getQRStatusAsync";

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(dataBody),
    });

    const dataQR: IStatusQR = await response.json();
    const { statusId, success, message, expirationDate } = dataQR;

    if (success) {
      if (statusId === 1) {
        const countRows = await authorize().then((auth) =>
          getFilledRowCount(auth)
        );
        const currentDate = new Date();
        const day = String(currentDate.getDate()).padStart(2, "0");
        const month = String(currentDate.getMonth() + 1).padStart(2, "0");
        const year = currentDate.getFullYear();
        const formattedDate = `${month}/${day}/${year}`;
        const newRow = [
          `${countRows + 1}`,
          phone,
          formattedDate,
          "Santa Cruz de la Sierra",
          qrId,
          idProduct,
          "hombre",
          amount,
          quantity,
          "Pendiente",
        ];
        authorize()
          .then((auth) => appendToNextColumn(auth, newRow))
          .catch(console.error);
      }
      const responseQR = {
        success: true,
        data: {
          statusId,
          expirationDate,
        },
        message,
      };
      return res.status(200).json(responseQR).end();
    } else {
      return res
        .status(400)
        .json({
          success: false,
          data: {},
          message,
        })
        .end();
    }
  } catch (error) {
    console.log(error);
    res
      .status(500)
      .json({ success: false, message: "Failed to get status" })
      .end();
  }
};
