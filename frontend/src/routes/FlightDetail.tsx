import { useNavigate, useParams } from "react-router-dom";
import { BuyDrawer } from "../components/drawer/BuyDrawer";
import { TowerShell } from "./TowerShell";

export function FlightDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  return (
    <>
      <TowerShell />
      {id && <BuyDrawer flightId={id} onClose={() => navigate("/")} />}
    </>
  );
}
