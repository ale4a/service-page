import express from "express";
import { getQR, statusQR, getToken } from "../controllers/payment";

const tokenMiddleware = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => {
  await getToken(req, res, next);
};

export default (router: express.Router) => {
  router.post("/payment/bnb/token", getToken);
  router.post("/payment/bnb/qr", tokenMiddleware, getQR);
  router.post("/payment/bnb/:qrId", tokenMiddleware, statusQR);
};
