import React, { useEffect, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { gameManager, BaseData } from '../services/gameManager'
import { useShipStore } from '../services/shipStore'

interface BaseManagerProps {
  planetRadius: number
  isMobile?: boolean
}

const CUBE_WIDTH = 0.06
const CUBE_HEIGHT = 0.02
const CUBE_DEPTH = 0.06

const baseGeometry = new THREE.BoxGeometry(1,1,1)

function Base({ data, isMobile }: { data: BaseData, isMobile:boolean }) {

  const groupRef = useRef<THREE.Group>(null)
  const highDetailRef = useRef<THREE.Group>(null)
  const lowDetailRef = useRef<THREE.Mesh>(null)

  const minerRef = useRef<THREE.Group>(null)
  const radarRef = useRef<THREE.Group>(null)
  const levitationRef = useRef<THREE.Mesh>(null)
  const landingLights = useRef<THREE.Group>(null)

  const { camera } = useThree()
  const { lockedTarget, setLockedTarget } = useShipStore()

  const isNPC = data.ownerId === 'npc'

  const color =
    isNPC ? '#888888'
    : data.zone === 'high' ? '#ef4444'
    : data.zone === 'mid' ? '#f59e0b'
    : '#3b82f6'

  const height = data.level * 2
  const totalHeight = height * CUBE_HEIGHT

  const isSelected = lockedTarget?.id === data.id

  const basePos = useRef(new THREE.Vector3())

  const handleBaseClick = (e:any) => {
    e.stopPropagation()
    setLockedTarget({ ...data, type:'base' })
  }

  useEffect(()=>{

    if(!groupRef.current) return

    const pos = new THREE.Vector3(
      data.position.x,
      data.position.y,
      data.position.z
    )

    basePos.current.copy(pos)

    const normal = pos.clone().normalize()

    groupRef.current.position.copy(pos)

    groupRef.current.quaternion.setFromUnitVectors(
      new THREE.Vector3(0,1,0),
      normal
    )

  },[data.position])

  useFrame((state)=>{

    if(!groupRef.current || !highDetailRef.current || !lowDetailRef.current) return

    const time = state.clock.elapsedTime

    /** FLOATING MOTION **/

    const hover = Math.sin(time*1.2) * 0.03

    const normal = basePos.current.clone().normalize()

    const offset = normal.multiplyScalar(hover)

    groupRef.current.position.copy(basePos.current.clone().add(offset))

    /** RADAR ROTATION **/

    if(radarRef.current){
      radarRef.current.rotation.y = time*1.2
    }

    /** MINER SPIN **/

    if(minerRef.current){
      minerRef.current.rotation.y = time*2
    }

    /** LEVITATION FIELD PULSE **/

    if(levitationRef.current){
      const mat:any = levitationRef.current.material
      mat.emissiveIntensity = 1 + Math.sin(time*3)*0.6
    }

    /** LANDING LIGHTS **/

    if(landingLights.current){

      landingLights.current.children.forEach((m:any,i)=>{

        const mat:any = m.material
        mat.emissiveIntensity = 1 + Math.sin(time*4 + i)*0.5

      })

    }

    /** LOD **/

    const dist = camera.position.distanceTo(groupRef.current.position)

    const maxDist = isMobile ? 12 : 13
    const fadeDist = isMobile ? 10 : 11

    if(dist > maxDist){
      groupRef.current.visible = false
      return
    }

    groupRef.current.visible = true

    let scale = 1

    if(dist > fadeDist){
      scale = 1 - (dist - fadeDist)/(maxDist - fadeDist)
      scale = scale*scale
    }

    groupRef.current.scale.setScalar(scale)

    if(dist > (isMobile?6:8)){
      highDetailRef.current.visible = false
      lowDetailRef.current.visible = true
    } else {
      highDetailRef.current.visible = true
      lowDetailRef.current.visible = false
    }

  })

  return(

    <group
      ref={groupRef}
      onClick={handleBaseClick}
      onPointerOver={()=>document.body.style.cursor='pointer'}
      onPointerOut={()=>document.body.style.cursor='default'}
    >

      {/* LEVITATION FIELD */}

      <mesh
        ref={levitationRef}
        rotation={[Math.PI/2,0,0]}
        position={[0,-0.02,0]}
      >
        <torusGeometry args={[CUBE_WIDTH*2.5,0.015,16,60]} />
        <meshStandardMaterial
          color="#22d3ee"
          emissive="#22d3ee"
          emissiveIntensity={1}
          transparent
          opacity={0.9}
        />
      </mesh>


      {/* SELECTION */}

      {isSelected && (
        <mesh position={[0,totalHeight/2,0]}>
          <cylinderGeometry args={[CUBE_WIDTH*2.6,CUBE_WIDTH*2.6,totalHeight+0.1,24]} />
          <meshBasicMaterial color="#ff0000" transparent opacity={0.25} side={THREE.BackSide}/>
        </mesh>
      )}

      {/* HIGH DETAIL */}

      <group ref={highDetailRef}>

        {/* PLATFORM */}

        <mesh position={[0,0.02,0]}>
          <cylinderGeometry args={[CUBE_WIDTH*2.2,CUBE_WIDTH*2.4,0.02,24]} />
          <meshStandardMaterial color={color} metalness={0.8} roughness={0.45}/>
        </mesh>

        {/* COMMAND TOWER */}

        <mesh position={[0,totalHeight*0.5+0.04,0]}>
          <cylinderGeometry args={[0.04,0.05,totalHeight,16]}/>
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={0.2}
            metalness={0.85}
            roughness={0.3}
          />
        </mesh>

        {/* ENERGY RING */}

        <mesh
          rotation={[Math.PI/2,0,0]}
          position={[0,totalHeight*0.7+0.05,0]}
        >
          <torusGeometry args={[0.09,0.008,12,40]} />
          <meshStandardMaterial
            color="#22d3ee"
            emissive="#22d3ee"
            emissiveIntensity={1.2}
          />
        </mesh>

        {/* REACTOR CORE */}

        <mesh position={[0,totalHeight+0.06,0]}>
          <sphereGeometry args={[0.025,16,16]}/>
          <meshStandardMaterial
            color="#a855f7"
            emissive="#a855f7"
            emissiveIntensity={2}
          />
        </mesh>

        {/* RADAR DISH */}

        <group
          ref={radarRef}
          position={[0.08,totalHeight+0.03,0]}
        >

          <mesh position={[0,-0.02,0]}>
            <cylinderGeometry args={[0.004,0.004,0.04,8]}/>
            <meshStandardMaterial color="#9ca3af"/>
          </mesh>

          <mesh position={[0,0.01,0]}>
            <boxGeometry args={[0.04,0.004,0.01]}/>
            <meshStandardMaterial color="#9ca3af"/>
          </mesh>

          <mesh position={[0.025,0.01,0]} rotation={[0,0,Math.PI/2]}>
            <coneGeometry args={[0.02,0.01,12,1,true]}/>
            <meshStandardMaterial
              color="#e5e7eb"
              emissive="#22d3ee"
              emissiveIntensity={0.3}
              metalness={0.85}
              roughness={0.2}
            />
          </mesh>

        </group>

        {/* LANDING LIGHTS */}

        <group ref={landingLights}>

          {[0,Math.PI/2,Math.PI,Math.PI*1.5].map((rot,i)=>{

            const x = Math.cos(rot)*0.12
            const z = Math.sin(rot)*0.12

            return(

              <mesh key={i} position={[x,0.02,z]}>
                <sphereGeometry args={[0.01,8,8]}/>
                <meshStandardMaterial
                  color="#22d3ee"
                  emissive="#22d3ee"
                  emissiveIntensity={1}
                />
              </mesh>

            )

          })}

        </group>

        {/* FACTION DECAL */}

        {!isNPC && (
          <mesh position={[0,totalHeight*0.5,0.07]}>
            <planeGeometry args={[0.05,0.05]}/>
            <meshBasicMaterial color={color} transparent opacity={0.9}/>
          </mesh>
        )}

        {/* MINER */}

        {data.hasMiner && (
          <group ref={minerRef} position={[0,totalHeight+0.1,0]}>
            <mesh rotation={[Math.PI/2,0,0]}>
              <torusGeometry args={[0.05,0.004,8,24]}/>
              <meshStandardMaterial
                color="#a855f7"
                emissive="#a855f7"
                emissiveIntensity={1}
              />
            </mesh>
          </group>
        )}

      </group>

      {/* LOW DETAIL */}

      <mesh
        ref={lowDetailRef}
        geometry={baseGeometry}
        position={[0,totalHeight/2,0]}
        scale={[CUBE_WIDTH*1.2,totalHeight,CUBE_DEPTH*1.2]}
        visible={false}
      >
        <meshStandardMaterial color={color}/>
      </mesh>

      {/* HEALTH BAR */}

      {data.health < 100 && (
        <Html position={[0,totalHeight+0.1,0]} center distanceFactor={10}>
          <div className="bg-black/80 border border-zinc-700 p-1 rounded w-16 flex flex-col items-center pointer-events-none">
            <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-red-500 h-full transition-all duration-300"
                style={{ width: `${data.health}%` }}
              />
            </div>
          </div>
        </Html>
      )}

    </group>
  )

}

export function BaseManager({ planetRadius, isMobile=false }: BaseManagerProps){

  const [bases,setBases] = useState<BaseData[]>([])

  useEffect(()=>{

    gameManager.onBasesUpdate = (newBases)=>{
      setBases(newBases)
    }

    if(gameManager.bases.length===0){
      gameManager.init()
    } else {
      setBases(gameManager.bases)
    }

    return ()=>{
      gameManager.onBasesUpdate = null
    }

  },[])

  return(
    <group>
      {bases.map(base=>(
        <Base key={base.id} data={base} isMobile={isMobile}/>
      ))}
    </group>
  )

}
