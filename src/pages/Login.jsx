import { Navigate } from 'react-router-dom';

export default function Login() {
  return <Navigate to="/?login=1" replace />;
}
