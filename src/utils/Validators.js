/**
 * Product Validators
 * Validates products based on various criteria
 */
export class Validators {
  static validateProduct(productData, primeOnly = false, getDeliveryDateFn = null) {
    const errors = [];

    if (!productData.price || productData.price === null || productData.price === '') {
      errors.push('No price available - item may be out of stock');
    }

    if (getDeliveryDateFn) {
      const deliveryDate = getDeliveryDateFn();
      if (deliveryDate) {
        const daysUntilDelivery = this.calculateDaysUntilDelivery(deliveryDate);
        if (daysUntilDelivery !== null && daysUntilDelivery > 10) {
          errors.push(`Delivery time too long (${daysUntilDelivery} days) - ships after ${deliveryDate}`);
        }
      }
    }

    if (primeOnly && productData.isPrime === false) {
      errors.push('Not eligible for Amazon Prime shipping');
    }

    return {
      isValid: errors.length === 0,
      errors: errors
    };
  }

  static validateProductFromDoc(productData, primeOnly = false) {
    const errors = [];

    if (!productData.price || productData.price === null || productData.price === '') {
      errors.push('No price available');
    }

    if (primeOnly && productData.isPrime === false) {
      errors.push('Not Prime eligible');
    }

    return {
      isValid: errors.length === 0,
      errors: errors
    };
  }

  static calculateDaysUntilDelivery(deliveryDateStr) {
    if (!deliveryDateStr) return null;

    try {
      const currentYear = new Date().getFullYear();
      const currentMonth = new Date().getMonth();

      const cleanDate = deliveryDateStr.replace(/^(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s*/i, '').trim();
      const deliveryDate = new Date(`${cleanDate}, ${currentYear}`);

      if (deliveryDate.getMonth() < currentMonth) {
        deliveryDate.setFullYear(currentYear + 1);
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      deliveryDate.setHours(0, 0, 0, 0);

      const diffTime = deliveryDate - today;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      return diffDays;
    } catch (error) {
      console.error('Error parsing delivery date:', error);
      return null;
    }
  }
}
