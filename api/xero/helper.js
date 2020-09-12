export const getRandomNumber = (range) =>
  Math.round(Math.random() * ((range || 100) - 1) + 1);

export const timeSince = (token) => {
  if (token) {
    const timestamp = token["exp"];
    const myDate = new Date(timestamp * 1000);
    return myDate.toLocaleString();
  } else {
    return "";
  }
};
export const authenticationData = (req, _res) => {
  return {
    decodedIdToken: req.session.decodedIdToken,
    tokenSet: req.session.tokenSet,
    decodedAccessToken: req.session.decodedAccessToken,
    accessTokenExpires: timeSince(req.session.decodedAccessToken),
    allTenants: req.session.allTenants,
    activeTenant: req.session.activeTenant,
  };
};
