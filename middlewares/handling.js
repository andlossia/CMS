const responseHandler = (req, res, next) => {
  const handleResponse = (status, message, error = null, data = null) => {
    const response = {
      status,
      message,
      timestamp: new Date().toISOString(),
      traceId: req.traceId || null,
    };
    if (error) response.error = error;
    if (data) response.data = data;
    res.status(status).json(response);
  };


  res.continue = (message = 'Continue') => handleResponse(100, message);
  res.switchingProtocols = (message = 'Switching protocols') => handleResponse(101, message);
  res.processing = (message = 'Processing') => handleResponse(102, message);
  res.earlyHints = (message = 'Early hints') => handleResponse(103, message);


  // Successful responses
  res.success = (data, message = 'Success') => handleResponse(200, message, null, data);
  res.created = (data, message = 'Resource created') => handleResponse(201, message, null, data);
  res.accepted = (message = 'Accepted') => handleResponse(202, message);
  res.nonAuthoritativeInformation = (message = 'Non-authoritative information') => handleResponse(203, message);
  res.noContent = (message = 'No content') => handleResponse(204, message);
  res.resetContent = (message = 'Reset content') => handleResponse(205, message);
  res.partialContent = (data, message = 'Partial content') => handleResponse(206, message, null, data);

  // Redirection messages
  res.multipleChoices = (message = 'Multiple choices') => handleResponse(300, message);
  res.movedPermanently = (message = 'Moved permanently') => handleResponse(301, message);
  res.found = (message = 'Found') => handleResponse(302, message);
  res.seeOther = (message = 'See other') => handleResponse(303, message);
  res.notModified = (message = 'Not modified') => handleResponse(304, message);
  res.useProxy = (message = 'Use proxy') => handleResponse(305, message);
  res.switchProxy = (message = 'Switch proxy') => handleResponse(306, message);
  res.temporaryRedirect = (message = 'Temporary redirect') => handleResponse(307, message);
  res.permanentRedirect = (message = 'Permanent redirect') => handleResponse(308, message);

  // Client error responses
  res.badRequest = (data, message = 'Bad request') => handleResponse(400, message, null, data);
  res.unauthorized = (message = 'Unauthorized', data = null, error = 'Invalid token') => handleResponse(401, message, error, data);
  res.paymentRequired = (message = 'Payment required') => handleResponse(402, message);
  res.forbidden = (message = 'Forbidden') => handleResponse(403, message);
  res.notFound = (message = 'Not found') => handleResponse(404, message);
  res.methodNotAllowed = (message = 'Method not allowed') => handleResponse(405, message);
  res.notAcceptable = (message = 'Not acceptable') => handleResponse(406, message);
  res.proxyAuthenticationRequired = (message = 'Proxy authentication required') => handleResponse(407, message);
  res.requestTimeout = (message = 'Request timeout') => handleResponse(408, message);
  res.conflict = (message = 'Conflict') => handleResponse(409, message);
  res.gone = (message = 'Gone') => handleResponse(410, message);
  res.lengthRequired = (message = 'Length required') => handleResponse(411, message);
  res.preconditionFailed = (message = 'Precondition failed') => handleResponse(412, message);
  res.payloadTooLarge = (message = 'Payload too large') => handleResponse(413, message);
  res.uriTooLong = (message = 'URI too long') => handleResponse(414, message);
  res.unsupportedMediaType = (message = 'Unsupported media type') => handleResponse(415, message);
  res.rangeNotSatisfiable = (message = 'Range not satisfiable') => handleResponse(416, message);
  res.expectationFailed = (message = 'Expectation failed') => handleResponse(417, message);
  res.imATeapot = (message = 'I\'m a teapot') => handleResponse(418, message);
  res.loginTimeout = (message = 'Login timeout') => handleResponse(419, message);
  res.enhanceYourCalm = (message = 'Enhance your calm') => handleResponse(420, message);
  res.misdirectedRequest = (message = 'Misdirected request') => handleResponse(421, message);
  res.unprocessableEntity = (message = 'Unprocessable entity') => handleResponse(422, message);
  res.locked = (message = 'Locked') => handleResponse(423, message);
  res.failedDependency = (message = 'Failed dependency') => handleResponse(424, message);
  res.tooEarly = (message = 'Too early') => handleResponse(425, message);
  res.upgradeRequired = (message = 'Upgrade required') => handleResponse(426, message);
  res.preconditionRequired = (message = 'Precondition required') => handleResponse(428, message);
  res.tooManyRequests = (message = 'Too many requests') => handleResponse(429, message);
  res.requestHeaderFieldsTooLarge = (message = 'Request header fields too large') => handleResponse(431, message);
  res.sessionExpired = (message = 'Session expired') => handleResponse(440, message);
  res.unavailableForLegalReasons = (message = 'Unavailable for legal reasons') => handleResponse(451, message);
  res.tokenExpired = (message = 'Token expired') => handleResponse(498, message);
  res.clientClosedRequest = (message = 'Client closed request') => handleResponse(499, message);


  // Server error responses
  res.internalServerError = (message = 'Internal server error') => handleResponse(500, message);
  res.notImplemented = (message = 'Not implemented') => handleResponse(501, message);
  res.badGateway = (message = 'Bad gateway') => handleResponse(502, message);
  res.serviceUnavailable = (message = 'Service unavailable') => handleResponse(503, message);
  res.gatewayTimeout = (message = 'Gateway timeout') => handleResponse(504, message);
  res.httpVersionNotSupported = (message = 'HTTP version not supported') => handleResponse(505, message);
  res.variantAlsoNegotiates = (message = 'Variant also negotiates') => handleResponse(506, message);
  res.insufficientStorage = (message = 'Insufficient storage') => handleResponse(507, message);
  res.loopDetected = (message = 'Loop detected') => handleResponse(508, message);
  res.notExtended = (message = 'Not extended') => handleResponse(510, message);
  res.networkAuthenticationRequired = (message = 'Network Authentication Required') => handleResponse(511, message);


  // Custom error response
  res.error = (status, message, error) => handleResponse(status, message, error);

  next();
};

module.exports = responseHandler;
