"use client"
import { useEffect } from "react"
import { supabase } from "../../lib/supabase"

export default function AdminPage() {
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      window.location.href = "/dashboard"
    })
  }, [])

  return (
    <div style={{
      minHeight:"100vh",background:"#07060A",
      display:"flex",alignItems:"center",justifyContent:"center",
      color:"white",fontFamily:"sans-serif",fontSize:14,
      letterSpacing:".1em",textTransform:"uppercase"
    }}>
      Loading admin panel...
    </div>
  )
}
