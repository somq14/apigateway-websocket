export const handler = async (event: unknown) => {
  console.info(event);
  return {
    statusCode: 200,
  };
};
