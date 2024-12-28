import { createBrowserRouter } from "react-router-dom";
import App from "../App";
import Login from "../pages/login/Login";
import Register from "../pages/login/Register";
import Home from '../pages/Home/Home';
import Room from "../pages/Room/Room";

const router = createBrowserRouter([
    {
        path: "/",
        element: <App />,
        children: [
            {
                path: "/",
                element: <div>Home</div>
            },
            {
                path: "/friends",
                element: <div>Friends</div>
            },
            {
                path: "/login",
                element: <Login />
            },
            {
                path: "/register",
                element: <Register />
            },
            {
                path: "/home",
                element: <Home />
            },
            {
                path: "/room",
                element: <Room />
            }
        ]
    }
])


export default router;