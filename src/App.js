import { Outlet } from "react-router-dom";
import { AuthProvider } from "./firebase/AuthContext";


function App() {
  return (
    <>
    <AuthProvider>
      <Outlet />
    </AuthProvider>
    </>
  );
}

export default App;
