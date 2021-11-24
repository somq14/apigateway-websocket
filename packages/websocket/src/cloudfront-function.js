var handler = (event) => {
  var request = event.request;

  request.uri
    .slice(1)
    .split("/")
    .forEach((dir, index) => {
      request.querystring[index.toString()] = { value: dir };
    });

  request.uri = "/";
  return request;
};
