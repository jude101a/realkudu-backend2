export default (schema) => {

    return async (req, res, next) => {

        try {

            const payload = {

                ...req.body,

                ...req.params,

                ...req.query

            };

            const { error } = schema.validate(payload);

            if (error) {

                return res.status(400).json({

                    success: false,

                    message: error.details[0].message

                });

            }

            next();

        } catch (err) {

            next(err);

        }

    };

};