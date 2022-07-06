import { Request, Response, NextFunction } from 'express';
import {
  CreateFoodInput,
  CreateOfferInput,
  EditVendorInput,
  VendorLoginInput,
} from '../dto';
import { Food, Offer, Order } from '../models';
import { GenerateSignature, ValidatePassword } from '../utility';
import { FindVendor } from './AdminController';

export const VendorLogin = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { email, password } = <VendorLoginInput>req.body;

  const existingVendor = await FindVendor('', email);

  if (existingVendor !== null) {
    // Validate & give access
    const validataion = await ValidatePassword(
      password,
      existingVendor.password,
      existingVendor.salt
    );

    if (validataion) {
      const signature = GenerateSignature({
        _id: existingVendor._id,
        emial: existingVendor.email,
        name: existingVendor.name,
        foodType: existingVendor.foodType,
      });
      return res.json(signature);
    } else {
      return res.json({
        message: 'Invalid password',
      });
    }
  }
};

export const GetVendorProfile = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { user } = req;
  if (user) {
    const existingVendor = await FindVendor(user._id);
    return res.json(existingVendor);
  } else {
    return res.json({
      message: 'vendor info not found',
    });
  }
};

export const UpdateVendorProfile = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { address, name, foodType, phone } = <EditVendorInput>req.body;
  const { user } = req;
  if (user) {
    const existingVendor = await FindVendor(user._id);
    if (existingVendor !== null) {
      existingVendor.foodType = foodType;
      existingVendor.address = address;
      existingVendor.name = name;
      existingVendor.phone = phone;

      const savedResult = await existingVendor.save();
      return res.json(savedResult);
    }
    return res.json(existingVendor);
  } else {
    return res.json({
      message: 'vendor info not found',
    });
  }
};

export const UpdateVendorCoverImage = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { user } = req;
  if (user) {
    const vendor = await FindVendor(user._id);

    if (vendor !== null) {
      const files = req.files as [Express.Multer.File];

      // Get all file names
      const images = files.map((file: Express.Multer.File) => file.filename);

      vendor.coverImages.push(...images);
      const savedResult = await vendor.save();

      return res.json(savedResult);
    }
  }
  return res.json({
    message: 'something went wrong with add food',
  });
};

export const UpdateVendorService = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { user } = req;

  const { lat, lng } = req.body;
  if (user) {
    const existingVendor = await FindVendor(user._id);
    if (existingVendor !== null) {
      existingVendor.serviceAvailable = !existingVendor.serviceAvailable;

      if (lat && lng) {
        existingVendor.lat = lat;
        existingVendor.lng = lng;
      }

      const savedResult = await existingVendor.save();
      return res.json(savedResult);
    }
    return res.json(existingVendor);
  } else {
    return res.json({
      message: 'vendor info not found',
    });
  }
};

export const AddFood = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { user } = req;
  if (user) {
    const { category, description, foodType, name, price, readyTime } = <
      CreateFoodInput
    >req.body;

    const vendor = await FindVendor(user._id);

    if (vendor !== null) {
      const files = req.files as [Express.Multer.File];

      // Get all file names
      const images = files.map((file: Express.Multer.File) => file.filename);

      const createdFood = await Food.create({
        vendorId: vendor._id,
        category: category,
        description: description,
        foodType: foodType,
        name: name,
        price: price,
        readyTime: readyTime,
        images: images,
      });

      vendor.foods.push(createdFood._id);
      const savedResult = await vendor.save();

      return res.json(savedResult);
    }
  }
  return res.json({
    message: 'something went wrong with add food',
  });
};

export const GetFoods = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { user } = req;
  if (user) {
    const foods = await Food.find({ vendorId: user._id });
    if (foods !== null) {
      return res.json(foods);
    }
  }
  return res.json({
    message: 'Foods information not found',
  });
};

export const GetCurrentOrders = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const user = req.user;
  if (user) {
    const orders = await Order.find({ vendorId: user._id }).populate(
      'items.food'
    );
    if (orders != null) {
      return res.status(200).json(orders);
    }
  }
  return res.json({
    message: 'Orders not found',
  });
};

export const GetOrderDetails = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const orderId = req.params.id;
  if (orderId) {
    const order = await Order.findById(orderId).populate('items.food');
    if (order != null) {
      return res.status(200).json(order);
    }
  }
  return res.json({
    message: 'Orders not found',
  });
};

export const ProcessOrder = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const orderId = req.params.id;
  const { status, remarks, time } = req.body;

  if (orderId) {
    const order = await Order.findById(orderId).populate('items');
    if (order != null) {
      order.orderStatus = status;
      order.remarks = remarks;
      if (time) order.readyTime = time;

      const orderResult = await order.save();
      if (orderResult != null) {
        return res.status(200).json(orderResult);
      }
    }
  }
  return res.json({
    message: 'Order not found',
  });
};

export const GetOffers = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const user = req.user;

  if (user) {
    let currentOffers = [];
    const offers = await Offer.find().populate('vendors');
    if (offers) {
      offers.map((offer) => {
        offer.vendors.map((vendor) => {
          if (vendor._id.toString() === user._id.toString()) {
            currentOffers.push(offer);
          }
        });

        if (offer.offerType == 'GENERIC') {
          currentOffers.push(offer);
        }
      });
    }
    return res.status(200).json(currentOffers);
  }

  return res.json({
    message: 'Offers not available!',
  });
};

export const AddOffer = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const user = req.user;

  if (user) {
    const {
      bank,
      bins,
      description,
      endValidity,
      isActive,
      minValue,
      offerAmount,
      offerType,
      pincode,
      promoType,
      promocode,
      startValidity,
      title,
    } = <CreateOfferInput>req.body;

    // check if vendor is valid

    const vendor = await FindVendor(user._id);
    if (vendor) {
      const offer = await Offer.create({
        bank: bank,
        bins: bins,
        description: description,
        endValidity: endValidity,
        isActive: isActive,
        minValue: minValue,
        offerAmount: offerAmount,
        offerType: offerType,
        pincode: pincode,
        promoType: promoType,
        promocode: promocode,
        startValidity: startValidity,
        title: title,
        vendors: [vendor],
      });

      return res.status(200).json(offer);
    }
  }
  return res.json({
    message: 'Offer not created',
  });
};

export const EditOffer = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const user = req.user;
  const offerId = req.params.id;
  if (user) {
    const {
      bank,
      bins,
      description,
      endValidity,
      isActive,
      minValue,
      offerAmount,
      offerType,
      pincode,
      promoType,
      promocode,
      startValidity,
      title,
    } = <CreateOfferInput>req.body;

    const currentOffer = await Offer.findById(offerId);
    if (currentOffer) {
      const vendor = await FindVendor(user._id);

      if (vendor) {
        currentOffer.bank = bank;
        currentOffer.bins = bins;
        currentOffer.description = description;
        currentOffer.endValidity = endValidity;
        currentOffer.isActive = isActive;
        currentOffer.minValue = minValue;
        currentOffer.offerAmount = offerAmount;
        currentOffer.offerType = offerType;
        currentOffer.pincode = pincode;
        currentOffer.promoType = promoType;
        currentOffer.promocode = promocode;
        currentOffer.startValidity = startValidity;
        currentOffer.title = title;

        const result = await currentOffer.save();

        return res.status(200).json(result);
      }
    }
  }
  return res.json({
    message: 'Unable to edit offer',
  });
};
