const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Get subscription info
router.get('/subscription', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get customer from Stripe
    const customers = await stripe.customers.list({
      email: req.user.email,
      limit: 1
    });

    if (customers.data.length === 0) {
      return res.json({ success: true, data: null });
    }

    const customer = customers.data[0];
    
    // Get active subscriptions
    const subscriptions = await stripe.subscriptions.list({
      customer: customer.id,
      status: 'active',
      limit: 1
    });

    if (subscriptions.data.length === 0) {
      return res.json({ success: true, data: null });
    }

    const subscription = subscriptions.data[0];
    
    res.json({
      success: true,
      data: {
        id: subscription.id,
        status: subscription.status,
        plan: subscription.items.data[0].price.nickname || 'Unknown Plan',
        amount: subscription.items.data[0].price.unit_amount,
        currency: subscription.items.data[0].price.currency,
        interval: subscription.items.data[0].price.recurring.interval,
        currentPeriodStart: new Date(subscription.current_period_start * 1000).toISOString(),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        trialEnd: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null
      }
    });

  } catch (error) {
    console.error('Get subscription error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get subscription info',
      details: error.message
    });
  }
});

// Get payment methods
router.get('/payment-methods', authenticateToken, async (req, res) => {
  try {
    // Get customer from Stripe
    const customers = await stripe.customers.list({
      email: req.user.email,
      limit: 1
    });

    if (customers.data.length === 0) {
      return res.json({ success: true, data: [] });
    }

    const customer = customers.data[0];
    
    // Get payment methods
    const paymentMethods = await stripe.paymentMethods.list({
      customer: customer.id,
      type: 'card'
    });

    const formattedMethods = paymentMethods.data.map(pm => ({
      id: pm.id,
      type: pm.type,
      brand: pm.card.brand,
      last4: pm.card.last4,
      expMonth: pm.card.exp_month,
      expYear: pm.card.exp_year,
      isDefault: customer.invoice_settings.default_payment_method === pm.id
    }));

    res.json({
      success: true,
      data: formattedMethods
    });

  } catch (error) {
    console.error('Get payment methods error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get payment methods',
      details: error.message
    });
  }
});

// Get invoices
router.get('/invoices', authenticateToken, async (req, res) => {
  try {
    // Get customer from Stripe
    const customers = await stripe.customers.list({
      email: req.user.email,
      limit: 1
    });

    if (customers.data.length === 0) {
      return res.json({ success: true, data: [] });
    }

    const customer = customers.data[0];
    
    // Get invoices
    const invoices = await stripe.invoices.list({
      customer: customer.id,
      limit: 10
    });

    const formattedInvoices = invoices.data.map(invoice => ({
      id: invoice.id,
      amount: invoice.amount_paid,
      currency: invoice.currency,
      status: invoice.status,
      date: new Date(invoice.created * 1000).toISOString(),
      description: invoice.lines.data[0]?.description || 'Subscription',
      downloadUrl: invoice.invoice_pdf
    }));

    res.json({
      success: true,
      data: formattedInvoices
    });

  } catch (error) {
    console.error('Get invoices error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get invoices',
      details: error.message
    });
  }
});

// Create customer portal session
router.post('/customer-portal', authenticateToken, async (req, res) => {
  try {
    // Get customer from Stripe
    const customers = await stripe.customers.list({
      email: req.user.email,
      limit: 1
    });

    if (customers.data.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'No customer found. Please subscribe to a plan first.' 
      });
    }

    const customer = customers.data[0];
    
    // Create portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: customer.id,
      return_url: `${process.env.FRONTEND_URL}/settings/billing`,
    });

    res.json({
      success: true,
      url: session.url
    });

  } catch (error) {
    console.error('Customer portal error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to create customer portal session',
      details: error.message
    });
  }
});

// Create Stripe Checkout Session
router.post('/create-checkout-session', authenticateToken, async (req, res) => {
  try {
    const { priceId, mode = 'subscription', successUrl, cancelUrl, quantity = 1 } = req.body;
    const userId = req.user.id;

    if (!priceId) {
      return res.status(400).json({ error: 'Price ID is required' });
    }

    // Get or create Stripe customer
    let customer;
    try {
      const customers = await stripe.customers.list({
        email: req.user.email,
        limit: 1
      });

      if (customers.data.length > 0) {
        customer = customers.data[0];
      } else {
        customer = await stripe.customers.create({
          email: req.user.email,
          name: req.user.name,
          metadata: {
            userId: userId
          }
        });
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
          quantity: quantity,
        }
      ],
      success_url: successUrl || `${process.env.FRONTEND_URL}/settings/usage?success=true`,
      cancel_url: cancelUrl || `${process.env.FRONTEND_URL}/settings/usage?cancelled=true`,
      metadata: {
        userId: userId,
        priceId: priceId,
        quantity: quantity.toString(),
        purchaseType: mode === 'payment' ? 'credits' : 'subscription'
      },
      subscription_data: mode === 'subscription' ? {
        metadata: {
          userId: userId
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

// Create subscription (for existing CheckoutForm - fallback)
router.post('/create-subscription', authenticateToken, async (req, res) => {
  try {
    const { priceId, paymentMethodId } = req.body;
    const userId = req.user.id;

    if (!priceId || !paymentMethodId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Price ID and payment method are required' 
      });
    }

    // Get or create customer
    let customer;
    const customers = await stripe.customers.list({
      email: req.user.email,
      limit: 1
    });

    if (customers.data.length > 0) {
      customer = customers.data[0];
    } else {
      customer = await stripe.customers.create({
        email: req.user.email,
        name: req.user.name,
        metadata: { userId }
      });
    }

    // Attach payment method to customer
    await stripe.paymentMethods.attach(paymentMethodId, {
      customer: customer.id,
    });

    // Set as default payment method
    await stripe.customers.update(customer.id, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });

    // Create subscription
    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{ price: priceId }],
      default_payment_method: paymentMethodId,
      expand: ['latest_invoice.payment_intent'],
      metadata: { userId }
    });

    res.json({
      success: true,
      data: {
        subscriptionId: subscription.id,
        clientSecret: subscription.latest_invoice.payment_intent?.client_secret
      }
    });

  } catch (error) {
    console.error('Create subscription error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to create subscription',
      details: error.message
    });
  }
});

// Cancel subscription
router.post('/cancel-subscription', authenticateToken, async (req, res) => {
  try {
    const { subscriptionId } = req.body;

    if (!subscriptionId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Subscription ID is required' 
      });
    }

    const subscription = await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true
    });

    res.json({
      success: true,
      data: {
        subscriptionId: subscription.id,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString()
      }
    });

  } catch (error) {
    console.error('Cancel subscription error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to cancel subscription',
      details: error.message
    });
  }
});

// Webhook endpoint for Stripe events
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log('📨 Webhook received:', event.type);

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        const session = event.data.object;
        console.log('✅ Checkout session completed:', session.id);
        
        // Handle credit purchases
        if (session.metadata?.purchaseType === 'credits') {
          await handleCreditPurchase(session);
        }
        break;

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        const subscription = event.data.object;
        console.log('🔔 Subscription event:', subscription.id, subscription.status);
        // Update user tier in your database based on subscription
        break;

      case 'customer.subscription.deleted':
        const deletedSubscription = event.data.object;
        console.log('❌ Subscription cancelled:', deletedSubscription.id);
        // Reset user to free tier in your database
        break;

      case 'invoice.payment_succeeded':
        const invoice = event.data.object;
        console.log('💰 Payment succeeded:', invoice.id);
        break;

      case 'invoice.payment_failed':
        const failedInvoice = event.data.object;
        console.log('❌ Payment failed:', failedInvoice.id);
        break;

      default:
        console.log('🤷 Unhandled event type:', event.type);
    }
  } catch (error) {
    console.error('Error processing webhook:', error);
    return res.status(400).send('Webhook handler failed');
  }

  res.json({ received: true });
});

// Helper function to handle credit purchases
async function handleCreditPurchase(session) {
  const { pool } = require('../config/data-sources');
  
  try {
    const userId = session.metadata.userId;
    const priceId = session.metadata.priceId;
    
    // Map price IDs to credit amounts (support both test and live)
    const CREDIT_BUNDLES = {
      // Live price ID for 250 credits
      'price_1RUNOmRxBJaRlFvtFDsOkRGL': 250,
      // Test price ID for 250 credits (add your test price ID here)
      [process.env.STRIPE_PRICE_CREDITS_250]: 250,
      // Fallback for testing/development
      'price_250_credits_bundle': 250,
    };
    
    const creditsToAdd = CREDIT_BUNDLES[priceId];
    
    if (!creditsToAdd) {
      console.error(`❌ Unknown price ID for credit purchase: ${priceId}`);
      return;
    }
    
    console.log(`💳 Adding ${creditsToAdd} credits to user ${userId} (Price ID: ${priceId})`);
    
    // Add credits to user's account
    await pool.query(
      'UPDATE users SET credits_remaining = credits_remaining + $1 WHERE id = $2',
      [creditsToAdd, userId]
    );

    // Log the credit addition
    await pool.query(
      `INSERT INTO activities (user_id, activity_type, title, description)
       VALUES ($1, $2, $3, $4)`,
      [
        userId,
        'credits_purchased',
        `Purchased ${creditsToAdd} Credits`,
        `${creditsToAdd} credits purchased via Stripe (Session: ${session.id})`
      ]
    );
    
    console.log(`✅ Successfully added ${creditsToAdd} credits to user ${userId}`);
  } catch (error) {
    console.error('Error adding credits:', error);
    // You might want to send an alert or email here for failed credit additions
  }
}

module.exports = router; 