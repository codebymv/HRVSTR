const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/authMiddleware');
const { pool } = require('../config/data-sources');

// Initialize Stripe with your secret key
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

/**
 * GET /api/billing/subscription
 * Get current user's subscription information from Stripe
 */
router.get('/subscription', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get user info including stripe_customer_id
    const userResult = await pool.query(
      'SELECT stripe_customer_id, stripe_subscription_id FROM users WHERE id = $1',
      [userId]
    );
    
    if (!userResult.rows[0]) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const user = userResult.rows[0];
    
    // If no Stripe customer ID, user doesn't have a paid subscription
    if (!user.stripe_customer_id || !user.stripe_subscription_id) {
      return res.json({
        success: true,
        data: null,
        message: 'No active subscription found'
      });
    }
    
    // Fetch real subscription data from Stripe
    try {
      const subscription = await stripe.subscriptions.retrieve(user.stripe_subscription_id);
      
      const subscriptionData = {
        id: subscription.id,
        status: subscription.status,
        plan: subscription.items.data[0]?.price?.nickname || 'Unknown',
        amount: subscription.items.data[0]?.price?.unit_amount || 0,
        currency: subscription.items.data[0]?.price?.currency || 'usd',
        interval: subscription.items.data[0]?.price?.recurring?.interval || 'month',
        currentPeriodStart: new Date(subscription.current_period_start * 1000).toISOString(),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
        cancelAtPeriodEnd: subscription.cancel_at_period_end
      };
      
      res.json({
        success: true,
        data: subscriptionData
      });
    } catch (stripeError) {
      console.error('Error fetching subscription from Stripe:', stripeError);
      res.json({
        success: true,
        data: null,
        message: 'Subscription not found in Stripe'
      });
    }

  } catch (error) {
    console.error('Error getting subscription info:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/billing/payment-methods
 * Get user's payment methods from Stripe
 */
router.get('/payment-methods', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const userResult = await pool.query(
      'SELECT stripe_customer_id FROM users WHERE id = $1',
      [userId]
    );
    
    if (!userResult.rows[0] || !userResult.rows[0].stripe_customer_id) {
      return res.json({
        success: true,
        data: [],
        message: 'No payment methods found'
      });
    }
    
    // Fetch real payment methods from Stripe
    try {
      const paymentMethods = await stripe.paymentMethods.list({
        customer: userResult.rows[0].stripe_customer_id,
        type: 'card',
      });
      
      const formattedMethods = paymentMethods.data.map(pm => ({
        id: pm.id,
        type: pm.type,
        brand: pm.card?.brand || 'unknown',
        last4: pm.card?.last4 || '****',
        expMonth: pm.card?.exp_month || 0,
        expYear: pm.card?.exp_year || 0,
        isDefault: false // You'd need to check customer's default payment method
      }));
      
      res.json({
        success: true,
        data: formattedMethods
      });
    } catch (stripeError) {
      console.error('Error fetching payment methods from Stripe:', stripeError);
      res.json({
        success: true,
        data: [],
        message: 'Could not fetch payment methods'
      });
    }

  } catch (error) {
    console.error('Error fetching payment methods:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/billing/invoices
 * Get user's invoice history from Stripe
 */
router.get('/invoices', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const userResult = await pool.query(
      'SELECT stripe_customer_id FROM users WHERE id = $1',
      [userId]
    );
    
    if (!userResult.rows[0] || !userResult.rows[0].stripe_customer_id) {
      return res.json({
        success: true,
        data: [],
        message: 'No invoices found'
      });
    }
    
    // Fetch real invoices from Stripe
    try {
      const invoices = await stripe.invoices.list({
        customer: userResult.rows[0].stripe_customer_id,
        limit: 10,
      });
      
      const formattedInvoices = invoices.data.map(invoice => ({
        id: invoice.id,
        amount: invoice.amount_paid,
        currency: invoice.currency,
        status: invoice.status === 'paid' ? 'paid' : invoice.status,
        date: new Date(invoice.created * 1000).toISOString(),
        description: invoice.lines.data[0]?.description || 'Subscription',
        downloadUrl: invoice.hosted_invoice_url
      }));
      
      res.json({
        success: true,
        data: formattedInvoices
      });
    } catch (stripeError) {
      console.error('Error fetching invoices from Stripe:', stripeError);
      res.json({
        success: true,
        data: [],
        message: 'Could not fetch invoices'
      });
    }

  } catch (error) {
    console.error('Error fetching invoices:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/billing/customer-portal
 * Create a Stripe customer portal session
 */
router.post('/customer-portal', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const userResult = await pool.query(
      'SELECT stripe_customer_id FROM users WHERE id = $1',
      [userId]
    );
    
    if (!userResult.rows[0]) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const user = userResult.rows[0];
    
    // If no Stripe customer, they need to subscribe first
    if (!user.stripe_customer_id) {
      return res.status(400).json({ 
        error: 'No payment account found. Please subscribe to a plan first.',
        action: 'redirect_to_pricing'
      });
    }
    
    // Create real Stripe customer portal session
    try {
      const session = await stripe.billingPortal.sessions.create({
        customer: user.stripe_customer_id,
        return_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/settings/billing`,
      });
      
      res.json({
        success: true,
        url: session.url
      });
    } catch (stripeError) {
      console.error('Error creating customer portal session:', stripeError);
      res.status(500).json({ error: 'Failed to create customer portal session' });
    }

  } catch (error) {
    console.error('Error creating customer portal session:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/billing/create-subscription
 * Create a new subscription for the user
 */
router.post('/create-subscription', authenticateToken, async (req, res) => {
  try {
    const { priceId, paymentMethodId } = req.body;
    const userId = req.user.id;
    
    if (!priceId) {
      return res.status(400).json({ error: 'Price ID is required' });
    }
    
    const userResult = await pool.query(
      'SELECT * FROM users WHERE id = $1',
      [userId]
    );
    
    if (!userResult.rows[0]) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const user = userResult.rows[0];
    let customerId = user.stripe_customer_id;
    
    try {
      // Create Stripe customer if one doesn't exist
      if (!customerId) {
        const customer = await createStripeCustomer(user);
        customerId = customer.id;
      }
      
      // If payment method is provided, attach it to the customer
      if (paymentMethodId) {
        await stripe.paymentMethods.attach(paymentMethodId, {
          customer: customerId,
        });
        
        // Set as default payment method
        await stripe.customers.update(customerId, {
          invoice_settings: {
            default_payment_method: paymentMethodId,
          },
        });
      }
      
      // Create the subscription
      const subscription = await stripe.subscriptions.create({
        customer: customerId,
        items: [{ price: priceId }],
        payment_behavior: 'default_incomplete',
        payment_settings: { save_default_payment_method: 'on_subscription' },
        expand: ['latest_invoice.payment_intent'],
      });
      
      // Update user record with subscription details
      await pool.query(
        'UPDATE users SET stripe_customer_id = $1, stripe_subscription_id = $2 WHERE id = $3',
        [customerId, subscription.id, userId]
      );
      
      res.json({
        success: true,
        data: {
          subscriptionId: subscription.id,
          clientSecret: subscription.latest_invoice.payment_intent.client_secret,
          status: subscription.status
        }
      });
      
    } catch (stripeError) {
      console.error('Error creating subscription:', stripeError);
      res.status(400).json({ 
        error: 'Failed to create subscription', 
        details: stripeError.message 
      });
    }

  } catch (error) {
    console.error('Error creating subscription:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/billing/cancel-subscription
 * Cancel user's current subscription
 */
router.post('/cancel-subscription', authenticateToken, async (req, res) => {
  try {
    const { immediate = false } = req.body;
    const userId = req.user.id;
    
    const userResult = await pool.query(
      'SELECT stripe_subscription_id FROM users WHERE id = $1',
      [userId]
    );
    
    if (!userResult.rows[0] || !userResult.rows[0].stripe_subscription_id) {
      return res.status(400).json({ error: 'No active subscription found' });
    }
    
    try {
      let subscription;
      
      if (immediate) {
        // Cancel immediately
        subscription = await stripe.subscriptions.cancel(userResult.rows[0].stripe_subscription_id);
        
        // Clear subscription ID from user record since it's immediately canceled
        await pool.query(
          'UPDATE users SET stripe_subscription_id = NULL WHERE id = $1',
          [userId]
        );
      } else {
        // Cancel at period end
        subscription = await stripe.subscriptions.update(
          userResult.rows[0].stripe_subscription_id,
          { cancel_at_period_end: true }
        );
      }
      
      res.json({
        success: true,
        message: immediate ? 'Subscription canceled immediately' : 'Subscription will cancel at period end',
        data: {
          status: subscription.status,
          cancelAtPeriodEnd: subscription.cancel_at_period_end
        }
      });
      
    } catch (stripeError) {
      console.error('Error canceling subscription:', stripeError);
      res.status(400).json({ 
        error: 'Failed to cancel subscription', 
        details: stripeError.message 
      });
    }

  } catch (error) {
    console.error('Error canceling subscription:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/billing/pricing
 * Get available pricing plans from Stripe
 */
router.get('/pricing', async (req, res) => {
  try {
    // In production, this would fetch from Stripe:
    // const prices = await stripe.prices.list({
    //   active: true,
    //   expand: ['data.product'],
    // });
    
    // Real pricing data with actual Stripe Price IDs
    const pricingPlans = [
      {
        id: process.env.STRIPE_PRICE_PRO_MONTHLY || 'price_1RU7GkRxBJaRlFvt0pcAxK8Q',
        product: 'HRVSTR Pro',
        amount: 1900, // $19.00 in cents
        currency: 'usd',
        interval: 'month',
        features: [
          '25 watchlist stocks',
          '500 scrape credits/month',
          'All sentiment sources',
          'Reddit sentiment (with your API keys)',
          'Full SEC filings access',
          'Up to 1-month historical data',
          'Theme customization'
        ]
      },
      {
        id: process.env.STRIPE_PRICE_PRO_YEARLY || 'price_1RU7HRRxBJaRlFvtmPFoZhmB',
        product: 'HRVSTR Pro',
        amount: 19000, // $190.00 in cents (10% discount)
        currency: 'usd',
        interval: 'year',
        features: [
          '25 watchlist stocks',
          '500 scrape credits/month',
          'All sentiment sources',
          'Reddit sentiment (with your API keys)',
          'Full SEC filings access',
          'Up to 1-month historical data',
          'Theme customization'
        ]
      },
      {
        id: process.env.STRIPE_PRICE_ELITE_MONTHLY || 'price_1RU7IIRxBJaRlFvtugLXLVDq',
        product: 'HRVSTR Elite',
        amount: 4900, // $49.00 in cents
        currency: 'usd',
        interval: 'month',
        features: [
          'Unlimited watchlist',
          '2000 scrape credits/month',
          'All data sources',
          'Reddit + Alpha Vantage integration',
          '3+ month historical data',
          'Advanced time range options',
          'Enhanced data refresh rates',
          'Usage analytics dashboard'
        ]
      },
      {
        id: process.env.STRIPE_PRICE_ELITE_YEARLY || 'price_1RU7IiRxBJaRlFvtvagv3s7J',
        product: 'HRVSTR Elite',
        amount: 49000, // $490.00 in cents (10% discount)
        currency: 'usd',
        interval: 'year',
        features: [
          'Unlimited watchlist',
          '2000 scrape credits/month',
          'All data sources',
          'Reddit + Alpha Vantage integration',
          '3+ month historical data',
          'Advanced time range options',
          'Enhanced data refresh rates',
          'Usage analytics dashboard'
        ]
      },
      {
        id: process.env.STRIPE_PRICE_INSTITUTIONAL_MONTHLY || 'price_1RU7JLRxBJaRlFvtcQWSwReg',
        product: 'HRVSTR Institutional',
        amount: 19900, // $199.00 in cents
        currency: 'usd',
        interval: 'month',
        features: [
          'Everything in Elite',
          '10,000 scrape credits/month',
          'Bulk data operations',
          'Extended historical data',
          'Multiple API key management',
          'Advanced usage monitoring',
          'Priority data processing',
          'Extended data retention'
        ]
      },
      {
        id: process.env.STRIPE_PRICE_INSTITUTIONAL_YEARLY || 'price_1RU7JsRxBJaRlFvthkm01EeY',
        product: 'HRVSTR Institutional',
        amount: 199000, // $1990.00 in cents (10% discount)
        currency: 'usd',
        interval: 'year',
        features: [
          'Everything in Elite',
          '10,000 scrape credits/month',
          'Bulk data operations',
          'Extended historical data',
          'Multiple API key management',
          'Advanced usage monitoring',
          'Priority data processing',
          'Extended data retention'
        ]
      }
    ];
    
    res.json({
      success: true,
      data: pricingPlans
    });

  } catch (error) {
    console.error('Error fetching pricing:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/billing/webhook
 * Handle Stripe webhooks for subscription events
 */
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
      event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      console.error('Webhook signature verification failed:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    switch (event.type) {
      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object);
        break;
        
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object);
        break;
        
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object);
        break;
        
      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object);
        break;
        
      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object);
        break;
        
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });

  } catch (error) {
    console.error('Error handling webhook:', error);
    res.status(400).json({ error: 'Webhook error' });
  }
});

/**
 * POST /api/billing/create-checkout-session
 * Create a Stripe Checkout Session for subscription
 */
router.post('/create-checkout-session', authenticateToken, async (req, res) => {
  try {
    const { priceId, mode = 'subscription', successUrl, cancelUrl } = req.body;
    const userId = req.user.id;

    if (!priceId) {
      return res.status(400).json({ error: 'Price ID is required' });
    }

    // Get user info
    const userResult = await pool.query(
      'SELECT * FROM users WHERE id = $1',
      [userId]
    );
    
    if (!userResult.rows[0]) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const user = userResult.rows[0];

    // Get or create Stripe customer
    let customer;
    try {
      const customers = await stripe.customers.list({
        email: user.email,
        limit: 1
      });

      if (customers.data.length > 0) {
        customer = customers.data[0];
      } else {
        customer = await stripe.customers.create({
          email: user.email,
          name: user.name,
          metadata: {
            userId: userId.toString()
          }
        });
        
        // Update user record with customer ID
        await pool.query(
          'UPDATE users SET stripe_customer_id = $1 WHERE id = $2',
          [customer.id, userId]
        );
      }
    } catch (error) {
      console.error('Error creating/finding customer:', error);
      return res.status(500).json({ error: 'Failed to create customer' });
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customer.id,
      payment_method_types: ['card'],
      mode: mode,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        }
      ],
      success_url: successUrl || `${process.env.FRONTEND_URL}/settings/billing?success=true`,
      cancel_url: cancelUrl || `${process.env.FRONTEND_URL}/settings/tiers?cancelled=true`,
      metadata: {
        userId: userId.toString(),
        priceId: priceId
      },
      subscription_data: mode === 'subscription' ? {
        metadata: {
          userId: userId.toString()
        }
      } : undefined,
      billing_address_collection: 'required',
      allow_promotion_codes: true,
    });

    res.json({ 
      url: session.url,
      sessionId: session.id 
    });

  } catch (error) {
    console.error('Create checkout session error:', error);
    res.status(500).json({ 
      error: 'Failed to create checkout session',
      details: error.message
    });
  }
});

// Helper functions for real Stripe integration

/**
 * Create a Stripe customer for a user
 */
async function createStripeCustomer(user) {
  try {
    const customer = await stripe.customers.create({
      email: user.email,
      name: user.name || user.given_name || user.email,
      metadata: {
        userId: user.id.toString()
      }
    });
    
    // Update user record with Stripe customer ID
    await pool.query(
      'UPDATE users SET stripe_customer_id = $1 WHERE id = $2',
      [customer.id, user.id]
    );
    
    return customer;
  } catch (error) {
    console.error('Error creating Stripe customer:', error);
    throw error;
  }
}

/**
 * Handle subscription created webhook
 */
async function handleSubscriptionCreated(subscription) {
  try {
    const customerId = subscription.customer;
    
    // Find user by customer ID
    const userResult = await pool.query(
      'SELECT id FROM users WHERE stripe_customer_id = $1',
      [customerId]
    );
    
    if (userResult.rows[0]) {
      await pool.query(
        'UPDATE users SET stripe_subscription_id = $1 WHERE id = $2',
        [subscription.id, userResult.rows[0].id]
      );
      
      // Update user tier based on subscription
      await updateUserTierFromSubscription(userResult.rows[0].id, subscription);
    }
  } catch (error) {
    console.error('Error handling subscription created:', error);
  }
}

/**
 * Handle subscription updated webhook
 */
async function handleSubscriptionUpdated(subscription) {
  try {
    const customerId = subscription.customer;
    
    const userResult = await pool.query(
      'SELECT id FROM users WHERE stripe_customer_id = $1',
      [customerId]
    );
    
    if (userResult.rows[0]) {
      await updateUserTierFromSubscription(userResult.rows[0].id, subscription);
    }
  } catch (error) {
    console.error('Error handling subscription updated:', error);
  }
}

/**
 * Handle subscription deleted webhook
 */
async function handleSubscriptionDeleted(subscription) {
  try {
    const customerId = subscription.customer;
    
    const userResult = await pool.query(
      'SELECT id FROM users WHERE stripe_customer_id = $1',
      [customerId]
    );
    
    if (userResult.rows[0]) {
      // Clear subscription and reset to free tier
      await pool.query(
        'UPDATE users SET stripe_subscription_id = NULL, tier = $1 WHERE id = $2',
        ['free', userResult.rows[0].id]
      );
    }
  } catch (error) {
    console.error('Error handling subscription deleted:', error);
  }
}

/**
 * Handle payment succeeded webhook
 */
async function handlePaymentSucceeded(invoice) {
  try {
    console.log('Payment succeeded for invoice:', invoice.id);
    // You could log this, send confirmation emails, etc.
  } catch (error) {
    console.error('Error handling payment succeeded:', error);
  }
}

/**
 * Handle payment failed webhook
 */
async function handlePaymentFailed(invoice) {
  try {
    console.log('Payment failed for invoice:', invoice.id);
    // You could send notification emails, temporarily suspend service, etc.
  } catch (error) {
    console.error('Error handling payment failed:', error);
  }
}

/**
 * Update user tier based on Stripe subscription
 */
async function updateUserTierFromSubscription(userId, subscription) {
  try {
    let tier = 'free';
    
    if (subscription.status === 'active' || subscription.status === 'trialing') {
      const priceId = subscription.items.data[0]?.price?.id;
      
      // Map Stripe price IDs to tiers
      if (priceId === process.env.STRIPE_PRICE_PRO_MONTHLY || priceId === process.env.STRIPE_PRICE_PRO_YEARLY) {
        tier = 'pro';
      } else if (priceId === process.env.STRIPE_PRICE_ELITE_MONTHLY || priceId === process.env.STRIPE_PRICE_ELITE_YEARLY) {
        tier = 'elite';
      } else if (priceId === process.env.STRIPE_PRICE_INSTITUTIONAL_MONTHLY || priceId === process.env.STRIPE_PRICE_INSTITUTIONAL_YEARLY) {
        tier = 'institutional';
      }
    }
    
    await pool.query(
      'UPDATE users SET tier = $1 WHERE id = $2',
      [tier, userId]
    );
    
    console.log(`Updated user ${userId} tier to ${tier}`);
  } catch (error) {
    console.error('Error updating user tier:', error);
  }
}

module.exports = router; 