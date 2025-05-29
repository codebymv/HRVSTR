// Create Stripe Checkout Session
router.post('/create-checkout-session', authenticateToken, async (req, res) => {
  try {
    const { priceId, mode = 'subscription', successUrl, cancelUrl } = req.body;
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
          quantity: 1,
        }
      ],
      success_url: successUrl || `${process.env.FRONTEND_URL}/settings/billing?success=true`,
      cancel_url: cancelUrl || `${process.env.FRONTEND_URL}/settings/tiers?cancelled=true`,
      metadata: {
        userId: userId,
        priceId: priceId
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